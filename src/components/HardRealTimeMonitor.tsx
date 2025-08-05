'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, RectifierData } from '@/lib/supabase'
import { AlertCircle, Power } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { ko } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
)

interface SlaveStatus {
  slave_id: number
  voltage: number
  current: number
  status_code: string
  timestamp: string
  isOnline: boolean
}

interface ChartDataPoint {
  x: Date
  y: number
}

export default function HardRealTimeMonitor() {
  const [voltageData, setVoltageData] = useState<{[key: number]: ChartDataPoint[]}>({})
  const [currentData, setCurrentData] = useState<{[key: number]: ChartDataPoint[]}>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  
  // 각 슬레이브별 개별 설정
  const [slaveSettings, setSlaveSettings] = useState<{[key: number]: { timeRange: '1m' | '5m' | '10m' | '30m' | '1h' | '1d' }}>({
    2: { timeRange: '30m' }, // 경질 1번 (슬레이브 2)
    1: { timeRange: '30m' }  // 경질 2번 (슬레이브 1)
  })
  
  const [slaveStatuses, setSlaveStatuses] = useState<SlaveStatus[]>([])

  // 경질 슬레이브 ID
  const hardSlaveIds = useMemo(() => [2, 1], []) // 경질 1번(슬레이브2), 경질 2번(슬레이브1)

  // 슬레이브 ID를 한국어 이름으로 변환
  const getSlaveDisplayName = (slaveId: number): string => {
    switch(slaveId) {
      case 2: return '경질1번'
      case 1: return '경질2번'
      default: return `슬레이브${slaveId}`
    }
  }

  // 시간 범위를 분 단위로 변환
  const getMinutesFromRange = (range: string): number => {
    switch(range) {
      case '1m': return 1
      case '5m': return 5
      case '10m': return 10
      case '30m': return 30
      case '1h': return 60
      case '1d': return 1440
      default: return 30
    }
  }

  // 상태 코드 해석 함수
  const getStatusDescription = (statusCode: string): { text: string; color: string } => {
    if (!statusCode) return { text: '상태 불명', color: 'text-gray-400' }
    
    const hexValue = parseInt(statusCode, 16)
    const numericValue = parseInt(statusCode, 10)
    
    if (isNaN(hexValue) && isNaN(numericValue)) {
      return { text: `상태: ${statusCode}`, color: 'text-gray-300' }
    }
    
    if (hexValue & 0x01) return { text: '과전압 보호', color: 'text-red-400' }
    if (hexValue & 0x02) return { text: '과전류 보호', color: 'text-red-400' }
    if (hexValue & 0x04) return { text: '과온도 보호', color: 'text-orange-400' }
    if (hexValue & 0x08) return { text: '통신 이상', color: 'text-yellow-400' }
    if (hexValue & 0x10) return { text: '팬 고장', color: 'text-orange-400' }
    if (hexValue & 0x20) return { text: '입력 전원 이상', color: 'text-red-400' }
    
    if (numericValue >= 200 && numericValue < 300) return { text: '정상 운전', color: 'text-blue-400' }
    if (numericValue >= 400 && numericValue < 500) return { text: '경고 상태', color: 'text-yellow-400' }
    if (numericValue >= 500) return { text: '오류 상태', color: 'text-red-400' }
    
    return { text: `상태: ${statusCode}`, color: 'text-blue-300' }
  }

  // 데이터 페칭 함수
  const fetchData = useCallback(async (slaveId: number, timeRange: string) => {
    try {
      const minutes = getMinutesFromRange(timeRange)
      const startTime = new Date(Date.now() - minutes * 60 * 1000).toISOString()
      
      const { data, error } = await supabase
        .from('정류기')
        .select('*')
        .eq('slave_id', slaveId)
        .gte('timestamp', startTime)
        .order('timestamp', { ascending: true })
        .limit(1000)

      if (error) throw error

      const voltagePoints: ChartDataPoint[] = []
      const currentPoints: ChartDataPoint[] = []
      
      data?.forEach((record: RectifierData) => {
        const timestamp = new Date(record.timestamp)
        if (record.voltage !== null) {
          voltagePoints.push({ x: timestamp, y: record.voltage })
        }
        if (record.current !== null) {
          currentPoints.push({ x: timestamp, y: record.current })
        }
      })

      setVoltageData(prev => ({ ...prev, [slaveId]: voltagePoints }))
      setCurrentData(prev => ({ ...prev, [slaveId]: currentPoints }))

      if (data && data.length > 0) {
        const latestRecord = data[data.length - 1]
        const lastTimestamp = new Date(latestRecord.timestamp)
        const isOnline = Date.now() - lastTimestamp.getTime() < 60000

        setSlaveStatuses(prev => {
          const updated = prev.filter(s => s.slave_id !== slaveId)
          updated.push({
            slave_id: slaveId,
            voltage: latestRecord.voltage || 0,
            current: latestRecord.current || 0,
            status_code: latestRecord.status_code || '',
            timestamp: latestRecord.timestamp,
            isOnline
          })
          return updated
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    }
  }, [])

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true)
      await Promise.all(
        hardSlaveIds.map(slaveId => 
          fetchData(slaveId, slaveSettings[slaveId].timeRange)
        )
      )
      setLoading(false)
    }

    loadInitialData()
  }, [fetchData, slaveSettings, hardSlaveIds])

  useEffect(() => {
    const subscription = supabase
      .channel('hard-realtime-changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: '정류기',
          filter: `slave_id=in.(${hardSlaveIds.join(',')})`
        }, 
        (payload: { new: RectifierData }) => {
          const newRecord = payload.new
          const timestamp = new Date(newRecord.timestamp)
          
          if (newRecord.voltage !== null) {
            setVoltageData(prev => ({
              ...prev,
              [newRecord.slave_id]: [
                ...(prev[newRecord.slave_id] || []).slice(-999),
                { x: timestamp, y: newRecord.voltage }
              ]
            }))
          }

          if (newRecord.current !== null) {
            setCurrentData(prev => ({
              ...prev,
              [newRecord.slave_id]: [
                ...(prev[newRecord.slave_id] || []).slice(-999),
                { x: timestamp, y: newRecord.current }
              ]
            }))
          }

          const isOnline = Date.now() - timestamp.getTime() < 60000
          setSlaveStatuses(prev => {
            const updated = prev.filter(s => s.slave_id !== newRecord.slave_id)
            updated.push({
              slave_id: newRecord.slave_id,
              voltage: newRecord.voltage || 0,
              current: newRecord.current || 0,
              status_code: newRecord.status_code || '',
              timestamp: newRecord.timestamp,
              isOnline
            })
            return updated
          })
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [hardSlaveIds])

  const handleTimeRangeChange = (slaveId: number, newRange: string) => {
    setSlaveSettings(prev => ({
      ...prev,
      [slaveId]: { ...prev[slaveId], timeRange: newRange as '1m' | '5m' | '10m' | '30m' | '1h' | '1d' }
    }))
    fetchData(slaveId, newRange)
  }

  if (loading) {
    return (
      <div className="p-6 bg-black min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-32 bg-gray-800 rounded"></div>
            <div className="h-32 bg-gray-800 rounded"></div>
          </div>
          <div className="h-64 bg-gray-800 rounded"></div>
          <div className="h-64 bg-gray-800 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-black min-h-screen">
        <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded mb-6 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-black min-h-screen space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">경질 실시간 모니터링</h2>
        <p className="text-gray-400">경질 1-2번 (슬레이브 2, 1번) 실시간 상태</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hardSlaveIds.map(slaveId => {
          const status = slaveStatuses.find(s => s.slave_id === slaveId)
          const statusInfo = getStatusDescription(status?.status_code || '')
          
          return (
            <div key={slaveId} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">{getSlaveDisplayName(slaveId)}</h3>
                <div className="flex items-center gap-2">
                  <Power className={`h-4 w-4 ${status?.isOnline ? 'text-blue-400' : 'text-gray-500'}`} />
                  <span className={`text-sm ${status?.isOnline ? 'text-blue-400' : 'text-gray-500'}`}>
                    {status?.isOnline ? '온라인' : '오프라인'}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">전압:</span>
                  <span className="text-white font-mono">{status?.voltage?.toFixed(1) || '0.0'}V</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">전류:</span>
                  <span className="text-white font-mono">{status?.current?.toFixed(1) || '0.0'}A</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">상태:</span>
                  <span className={`${statusInfo.color} text-sm`}>{statusInfo.text}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">시간:</span>
                  <span className="text-gray-300 text-sm font-mono">
                    {status?.timestamp ? formatInTimeZone(new Date(status.timestamp), 'Asia/Seoul', 'MM-dd HH:mm:ss', { locale: ko }) : '--:--:--'}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-gray-400 text-sm block mb-2">시간 범위:</label>
                <select
                  value={slaveSettings[slaveId].timeRange}
                  onChange={(e) => handleTimeRangeChange(slaveId, e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                >
                  <option value="1m">1분</option>
                  <option value="5m">5분</option>
                  <option value="10m">10분</option>
                  <option value="30m">30분</option>
                  <option value="1h">1시간</option>
                  <option value="1d">1일</option>
                </select>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">경질 1번 전압</h3>
            <span className="text-xs text-gray-400 font-mono">V</span>
          </div>
          <div className="h-48 relative">
            <Line 
              data={{
                datasets: [{
                  label: '경질1번 전압',
                  data: voltageData[2] || [],
                  borderColor: '#3b82f6',
                  backgroundColor: 'transparent',
                  borderWidth: 1.5,
                  fill: false,
                  tension: 0.3,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                  pointBackgroundColor: '#3b82f6',
                  pointBorderColor: '#ffffff',
                  pointBorderWidth: 1,
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' as const },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    cornerRadius: 6,
                    displayColors: false,
                    titleFont: { size: 11 },
                    bodyFont: { size: 11 },
                    callbacks: {
                      title: (context) => {
                        if (context[0]?.parsed?.x) {
                          return formatInTimeZone(new Date(context[0].parsed.x), 'Asia/Seoul', 'MM-dd HH:mm:ss', { locale: ko })
                        }
                        return ''
                      },
                      label: (context) => {
                        const timestamp = new Date(context.parsed.x)
                        const currentPoints = currentData[2] || []
                        const closestCurrent = currentPoints.find(p => 
                          Math.abs(p.x.getTime() - timestamp.getTime()) < 30000
                        )
                        
                        return [
                          `전압: ${context.parsed.y.toFixed(1)}V`,
                          `전류: ${closestCurrent?.y.toFixed(1) || '0.0'}A`
                        ]
                      }
                    }
                  }
                },
                scales: {
                  x: { type: 'time' as const, adapters: { date: { locale: ko } }, display: false },
                  y: {
                    grid: { color: '#374151' },
                    border: { display: false },
                    ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 4 }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">경질 1번 전류</h3>
            <span className="text-xs text-gray-400 font-mono">A</span>
          </div>
          <div className="h-48 relative">
            <Line 
              data={{
                datasets: [{
                  label: '경질1번 전류',
                  data: currentData[2] || [],
                  borderColor: '#3b82f6',
                  backgroundColor: 'transparent',
                  borderWidth: 1.5,
                  fill: false,
                  tension: 0.3,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                  pointBackgroundColor: '#3b82f6',
                  pointBorderColor: '#ffffff',
                  pointBorderWidth: 1,
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' as const },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    cornerRadius: 6,
                    displayColors: false,
                    titleFont: { size: 11 },
                    bodyFont: { size: 11 },
                    callbacks: {
                      title: (context) => {
                        if (context[0]?.parsed?.x) {
                          return formatInTimeZone(new Date(context[0].parsed.x), 'Asia/Seoul', 'MM-dd HH:mm:ss', { locale: ko })
                        }
                        return ''
                      },
                      label: (context) => {
                        const timestamp = new Date(context.parsed.x)
                        const voltagePoints = voltageData[2] || []
                        const closestVoltage = voltagePoints.find(p => 
                          Math.abs(p.x.getTime() - timestamp.getTime()) < 30000
                        )
                        
                        return [
                          `전압: ${closestVoltage?.y.toFixed(1) || '0.0'}V`,
                          `전류: ${context.parsed.y.toFixed(1)}A`
                        ]
                      }
                    }
                  }
                },
                scales: {
                  x: { type: 'time' as const, adapters: { date: { locale: ko } }, display: false },
                  y: {
                    grid: { color: '#374151' },
                    border: { display: false },
                    ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 4 }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">경질 2번 전압</h3>
            <span className="text-xs text-gray-400 font-mono">V</span>
          </div>
          <div className="h-48 relative">
            <Line 
              data={{
                datasets: [{
                  label: '경질2번 전압',
                  data: voltageData[1] || [],
                  borderColor: '#60a5fa',
                  backgroundColor: 'transparent',
                  borderWidth: 1.5,
                  fill: false,
                  tension: 0.3,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                  pointBackgroundColor: '#60a5fa',
                  pointBorderColor: '#ffffff',
                  pointBorderWidth: 1,
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' as const },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#60a5fa',
                    borderWidth: 1,
                    cornerRadius: 6,
                    displayColors: false,
                    titleFont: { size: 11 },
                    bodyFont: { size: 11 },
                    callbacks: {
                      title: (context) => {
                        if (context[0]?.parsed?.x) {
                          return formatInTimeZone(new Date(context[0].parsed.x), 'Asia/Seoul', 'MM-dd HH:mm:ss', { locale: ko })
                        }
                        return ''
                      },
                      label: (context) => {
                        const timestamp = new Date(context.parsed.x)
                        const currentPoints = currentData[1] || []
                        const closestCurrent = currentPoints.find(p => 
                          Math.abs(p.x.getTime() - timestamp.getTime()) < 30000
                        )
                        
                        return [
                          `전압: ${context.parsed.y.toFixed(1)}V`,
                          `전류: ${closestCurrent?.y.toFixed(1) || '0.0'}A`
                        ]
                      }
                    }
                  }
                },
                scales: {
                  x: {
                    type: 'time' as const,
                    adapters: { date: { locale: ko } },
                    ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 6 },
                    grid: { display: false }
                  },
                  y: {
                    grid: { color: '#374151' },
                    border: { display: false },
                    ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 4 }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">경질 2번 전류</h3>
            <span className="text-xs text-gray-400 font-mono">A</span>
          </div>
          <div className="h-48 relative">
            <Line 
              data={{
                datasets: [{
                  label: '경질2번 전류',
                  data: currentData[1] || [],
                  borderColor: '#60a5fa',
                  backgroundColor: 'transparent',
                  borderWidth: 1.5,
                  fill: false,
                  tension: 0.3,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                  pointBackgroundColor: '#60a5fa',
                  pointBorderColor: '#ffffff',
                  pointBorderWidth: 1,
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' as const },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#60a5fa',
                    borderWidth: 1,
                    cornerRadius: 6,
                    displayColors: false,
                    titleFont: { size: 11 },
                    bodyFont: { size: 11 },
                    callbacks: {
                      title: (context) => {
                        if (context[0]?.parsed?.x) {
                          return formatInTimeZone(new Date(context[0].parsed.x), 'Asia/Seoul', 'MM-dd HH:mm:ss', { locale: ko })
                        }
                        return ''
                      },
                      label: (context) => {
                        const timestamp = new Date(context.parsed.x)
                        const voltagePoints = voltageData[1] || []
                        const closestVoltage = voltagePoints.find(p => 
                          Math.abs(p.x.getTime() - timestamp.getTime()) < 30000
                        )
                        
                        return [
                          `전압: ${closestVoltage?.y.toFixed(1) || '0.0'}V`,
                          `전류: ${context.parsed.y.toFixed(1)}A`
                        ]
                      }
                    }
                  }
                },
                scales: {
                  x: {
                    type: 'time' as const,
                    adapters: { date: { locale: ko } },
                    ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 6 },
                    grid: { display: false }
                  },
                  y: {
                    grid: { color: '#374151' },
                    border: { display: false },
                    ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 4 }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
