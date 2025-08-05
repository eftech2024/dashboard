'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, RectifierData } from '../lib/supabase'
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

export default function SoftRealTimeMonitor() {
  const [voltageData, setVoltageData] = useState<{[key: number]: ChartDataPoint[]}>({})
  const [currentData, setCurrentData] = useState<{[key: number]: ChartDataPoint[]}>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [globalTimeRange, setGlobalTimeRange] = useState<'1m' | '5m' | '30m' | '1h' | '1d'>('30m')
  const [slaveStatuses, setSlaveStatuses] = useState<SlaveStatus[]>([])
  const softSlaveIds = useMemo(() => [3, 4], [])

  const getSlaveDisplayName = (slaveId: number): string => {
    switch(slaveId) {
      case 3: return '연질1번'
      case 4: return '연질2번'
      default: return `슬레이브${slaveId}`
    }
  }

  const getMinutesFromRange = (range: string): number => {
    switch(range) {
      case '1m': return 1
      case '5m': return 5
      case '30m': return 30
      case '1h': return 60
      case '1d': return 1440
      default: return 30
    }
  }

  const fetchData = useCallback(async (timeRange: string) => {
    try {
      const minutes = getMinutesFromRange(timeRange)
      const startTime = new Date(Date.now() - minutes * 60 * 1000).toISOString()
      
      const { data, error } = await supabase
        .from('정류기')
        .select('*')
        .in('slave_id', softSlaveIds)
        .gte('timestamp', startTime)
        .order('timestamp', { ascending: true })
        .limit(2000)

      if (error) throw error

      const newVoltageData: {[key: number]: ChartDataPoint[]} = {}
      const newCurrentData: {[key: number]: ChartDataPoint[]} = {}
      const statusMap: {[key: number]: RectifierData} = {}

      softSlaveIds.forEach(id => {
        newVoltageData[id] = []
        newCurrentData[id] = []
      })

      data?.forEach((record: RectifierData) => {
        const timestamp = new Date(record.timestamp)
        
        if (record.voltage !== null) {
          newVoltageData[record.slave_id].push({ x: timestamp, y: record.voltage })
        }
        if (record.current !== null) {
          newCurrentData[record.slave_id].push({ x: timestamp, y: record.current })
        }
        
        if (!statusMap[record.slave_id] || new Date(record.timestamp) > new Date(statusMap[record.slave_id].timestamp)) {
          statusMap[record.slave_id] = record
        }
      })

      setVoltageData(newVoltageData)
      setCurrentData(newCurrentData)

      const newStatuses: SlaveStatus[] = []
      softSlaveIds.forEach(slaveId => {
        const latest = statusMap[slaveId]
        if (latest) {
          const lastTimestamp = new Date(latest.timestamp)
          const isOnline = Date.now() - lastTimestamp.getTime() < 120000

          newStatuses.push({
            slave_id: slaveId,
            voltage: latest.voltage || 0,
            current: latest.current || 0,
            status_code: latest.status_code || '',
            timestamp: latest.timestamp,
            isOnline
          })
        }
      })
      
      setSlaveStatuses(newStatuses)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    }
  }, [softSlaveIds])

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true)
      await fetchData(globalTimeRange)
      setLoading(false)
    }

    loadInitialData()
  }, [fetchData, globalTimeRange])

  if (loading) {
    return (
      <div className="p-8 bg-black min-h-screen">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-800 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-80 bg-gray-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 bg-black min-h-screen">
        <div className="bg-red-900 border border-red-600 text-red-200 px-6 py-4 rounded-xl mb-8 flex items-center">
          <AlertCircle className="h-6 w-6 mr-3" />
          <span className="text-lg">{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-black min-h-screen space-y-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-3">연질 실시간 모니터링</h1>
        <p className="text-xl text-gray-400">연질 1-2번 (슬레이브 3, 4)</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {softSlaveIds.map((slaveId) => {
          const slaveName = getSlaveDisplayName(slaveId)
          const status = slaveStatuses.find(s => s.slave_id === slaveId)
          const color = slaveId === 3 ? '#10b981' : '#34d399'
          
          return [
            <div 
              key={`${slaveId}-voltage`}
              className="bg-gray-900/60 backdrop-blur border border-gray-700 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">{slaveName} 전압</h3>
                <div className="flex items-center gap-3">
                  <Power className={`h-5 w-5 ${status?.isOnline ? 'text-emerald-400' : 'text-gray-500'}`} />
                  <span className="text-2xl font-mono font-bold" style={{ color }}>
                    {status?.voltage?.toFixed(1) || '0.0'}V
                  </span>
                </div>
              </div>
              
              <div className="h-64 relative mb-4">
                <Line 
                  data={{
                    datasets: [{
                      label: `${slaveName} 전압`,
                      data: voltageData[slaveId] || [],
                      borderColor: color,
                      backgroundColor: 'transparent',
                      borderWidth: 2,
                      fill: false,
                      tension: 0.3,
                      pointRadius: 0,
                      pointHoverRadius: 5,
                      pointBackgroundColor: color,
                      pointBorderColor: '#ffffff',
                      pointBorderWidth: 2
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { intersect: false, mode: 'index' as const },
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { 
                        type: 'time' as const, 
                        adapters: { date: { locale: ko } }, 
                        ticks: { color: '#9ca3af', font: { size: 11 } },
                        grid: { color: '#374151' },
                        border: { display: false }
                      },
                      y: {
                        grid: { color: '#374151' },
                        border: { display: false },
                        ticks: { 
                          color: '#9ca3af', 
                          font: { size: 11 }, 
                          callback: (value) => `${value}V`
                        }
                      }
                    }
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">전류: <span className="text-white font-mono font-bold">{status?.current?.toFixed(1) || '0.0'}A</span></span>
                <span className="text-gray-400 font-mono">
                  {status?.timestamp ? 
                    formatInTimeZone(new Date(status.timestamp), 'Asia/Seoul', 'HH:mm:ss', { locale: ko }) : 
                    '--:--:--'
                  }
                </span>
              </div>
            </div>,
            
            <div 
              key={`${slaveId}-current`}
              className="bg-gray-900/60 backdrop-blur border border-gray-700 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">{slaveName} 전류</h3>
                <div className="flex items-center gap-3">
                  <Power className={`h-5 w-5 ${status?.isOnline ? 'text-emerald-400' : 'text-gray-500'}`} />
                  <span className="text-2xl font-mono font-bold" style={{ color }}>
                    {status?.current?.toFixed(1) || '0.0'}A
                  </span>
                </div>
              </div>
              
              <div className="h-64 relative mb-4">
                <Line 
                  data={{
                    datasets: [{
                      label: `${slaveName} 전류`,
                      data: currentData[slaveId] || [],
                      borderColor: color,
                      backgroundColor: 'transparent',
                      borderWidth: 2,
                      fill: false,
                      tension: 0.3,
                      pointRadius: 0,
                      pointHoverRadius: 5,
                      pointBackgroundColor: color,
                      pointBorderColor: '#ffffff',
                      pointBorderWidth: 2
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { intersect: false, mode: 'index' as const },
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { 
                        type: 'time' as const, 
                        adapters: { date: { locale: ko } }, 
                        ticks: { color: '#9ca3af', font: { size: 11 } },
                        grid: { color: '#374151' },
                        border: { display: false }
                      },
                      y: {
                        grid: { color: '#374151' },
                        border: { display: false },
                        ticks: { 
                          color: '#9ca3af', 
                          font: { size: 11 }, 
                          callback: (value) => `${value}A`
                        }
                      }
                    }
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">전압: <span className="text-white font-mono font-bold">{status?.voltage?.toFixed(1) || '0.0'}V</span></span>
                <span className="text-gray-400 font-mono">
                  {status?.timestamp ? 
                    formatInTimeZone(new Date(status.timestamp), 'Asia/Seoul', 'HH:mm:ss', { locale: ko }) : 
                    '--:--:--'
                  }
                </span>
              </div>
            </div>
          ]
        })}
      </div>
    </div>
  )
}
