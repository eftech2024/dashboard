'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertCircle, FileText, Clock, User, CheckCircle } from 'lucide-react'
import { formatInTimeZone } from 'date-fns-tz'
import { ko } from 'date-fns/locale'

interface WorkLog {
  id: number
  title: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to: string | null
  created_at: string
  updated_at: string
  due_date: string | null
}

export default function WorkLogsPage() {
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'priority' | 'due_date'>('created_at')

  // 상태 표시 함수
  const getStatusInfo = (status: WorkLog['status']) => {
    switch (status) {
      case 'pending':
        return { text: '대기 중', color: 'text-yellow-400', bg: 'bg-yellow-900/20', icon: Clock }
      case 'in_progress':
        return { text: '진행 중', color: 'text-blue-400', bg: 'bg-blue-900/20', icon: FileText }
      case 'completed':
        return { text: '완료', color: 'text-green-400', bg: 'bg-green-900/20', icon: CheckCircle }
      case 'cancelled':
        return { text: '취소', color: 'text-gray-400', bg: 'bg-gray-900/20', icon: AlertCircle }
      default:
        return { text: '알 수 없음', color: 'text-gray-400', bg: 'bg-gray-900/20', icon: AlertCircle }
    }
  }

  // 우선순위 표시 함수
  const getPriorityInfo = (priority: WorkLog['priority']) => {
    switch (priority) {
      case 'urgent':
        return { text: '긴급', color: 'text-red-400', bg: 'bg-red-900/20' }
      case 'high':
        return { text: '높음', color: 'text-orange-400', bg: 'bg-orange-900/20' }
      case 'medium':
        return { text: '보통', color: 'text-yellow-400', bg: 'bg-yellow-900/20' }
      case 'low':
        return { text: '낮음', color: 'text-green-400', bg: 'bg-green-900/20' }
      default:
        return { text: '보통', color: 'text-gray-400', bg: 'bg-gray-900/20' }
    }
  }

  // 작업 로그 페칭
  useEffect(() => {
    const fetchWorkLogs = async () => {
      try {
        setLoading(true)
        
        let query = supabase
          .from('work_data')  // 테이블 이름을 'work_data'로 변경
          .select('*')

        // 필터 적용
        if (filter !== 'all') {
          query = query.eq('status', filter)
        }

        // 정렬 적용
        query = query.order(sortBy, { ascending: false })

        const { data, error } = await query

        if (error) throw error

        setWorkLogs(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch work logs')
      } finally {
        setLoading(false)
      }
    }

    fetchWorkLogs()
  }, [filter, sortBy])

  // 실시간 구독
  useEffect(() => {
    const subscription = supabase
      .channel('work-logs-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'work_data' }, 
        () => {
          // 데이터 다시 페칭
          const fetchWorkLogs = async () => {
            try {
              let query = supabase
                .from('work_data')  // 테이블 이름을 'work_data'로 변경
                .select('*')

              if (filter !== 'all') {
                query = query.eq('status', filter)
              }

              query = query.order(sortBy, { ascending: false })

              const { data, error } = await query
              if (error) throw error
              setWorkLogs(data || [])
            } catch (err) {
              console.error('Failed to refetch work logs:', err)
            }
          }
          
          fetchWorkLogs()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [filter, sortBy])

  if (loading) {
    return (
      <div className="p-6 bg-black min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/3"></div>
          <div className="flex gap-4">
            <div className="h-10 bg-gray-800 rounded w-32"></div>
            <div className="h-10 bg-gray-800 rounded w-32"></div>
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-800 rounded"></div>
          ))}
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
        <h2 className="text-2xl font-bold text-white mb-2">작업 로그</h2>
        <p className="text-gray-400">정류기 시설 관련 작업 및 점검 기록</p>
      </div>

      {/* 필터 및 정렬 컨트롤 */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-gray-400 text-sm">상태 필터:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
          >
            <option value="all">전체</option>
            <option value="pending">대기 중</option>
            <option value="in_progress">진행 중</option>
            <option value="completed">완료</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-gray-400 text-sm">정렬:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
          >
            <option value="created_at">생성일</option>
            <option value="updated_at">수정일</option>
            <option value="priority">우선순위</option>
            <option value="due_date">마감일</option>
          </select>
        </div>
      </div>

      {/* 작업 로그 목록 */}
      <div className="space-y-4">
        {workLogs.length === 0 ? (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center">
            <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">표시할 작업 로그가 없습니다.</p>
          </div>
        ) : (
          workLogs.map((log) => {
            const statusInfo = getStatusInfo(log.status)
            const priorityInfo = getPriorityInfo(log.priority)
            const StatusIcon = statusInfo.icon

            return (
              <div key={log.id} className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{log.title}</h3>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusInfo.bg}`}>
                        <StatusIcon className={`h-3 w-3 ${statusInfo.color}`} />
                        <span className={statusInfo.color}>{statusInfo.text}</span>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs ${priorityInfo.bg} ${priorityInfo.color}`}>
                        {priorityInfo.text}
                      </div>
                    </div>
                    
                    <p className="text-gray-300 text-sm mb-3 leading-relaxed">
                      {log.content}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>생성: {formatInTimeZone(new Date(log.created_at), 'Asia/Seoul', 'yyyy-MM-dd HH:mm', { locale: ko })}</span>
                      </div>
                      
                      {log.updated_at !== log.created_at && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>수정: {formatInTimeZone(new Date(log.updated_at), 'Asia/Seoul', 'yyyy-MM-dd HH:mm', { locale: ko })}</span>
                        </div>
                      )}

                      {log.assigned_to && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>담당: {log.assigned_to}</span>
                        </div>
                      )}

                      {log.due_date && (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>마감: {formatInTimeZone(new Date(log.due_date), 'Asia/Seoul', 'yyyy-MM-dd', { locale: ko })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 통계 정보 */}
      {workLogs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white mb-1">
              {workLogs.filter(log => log.status === 'pending').length}
            </div>
            <div className="text-sm text-gray-400">대기 중</div>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400 mb-1">
              {workLogs.filter(log => log.status === 'in_progress').length}
            </div>
            <div className="text-sm text-gray-400">진행 중</div>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400 mb-1">
              {workLogs.filter(log => log.status === 'completed').length}
            </div>
            <div className="text-sm text-gray-400">완료</div>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white mb-1">
              {workLogs.length}
            </div>
            <div className="text-sm text-gray-400">전체</div>
          </div>
        </div>
      )}
    </div>
  )
}
