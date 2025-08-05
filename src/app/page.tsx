import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8">
          정류기 모니터링 대시보드
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Link 
            href="/monitoring/hard"
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:bg-gray-800 transition-colors"
          >
            <h2 className="text-xl font-semibold mb-3">경질 실시간 모니터링</h2>
            <p className="text-gray-400">경질 1-2번 슬레이브 실시간 전압/전류 모니터링</p>
          </Link>

          <Link 
            href="/monitoring/soft"
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:bg-gray-800 transition-colors"
          >
            <h2 className="text-xl font-semibold mb-3">연질 실시간 모니터링</h2>
            <p className="text-gray-400">연질 1-2번 슬레이브 실시간 전압/전류 모니터링</p>
          </Link>

          <Link 
            href="/work-logs"
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:bg-gray-800 transition-colors"
          >
            <h2 className="text-xl font-semibold mb-3">작업 로그</h2>
            <p className="text-gray-400">작업 기록 및 타임스탬프 관리</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
