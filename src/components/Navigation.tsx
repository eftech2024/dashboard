'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Monitor, Activity, FileText } from 'lucide-react'

export default function Navigation() {
  const pathname = usePathname()

  const navItems = [
    {
      href: '/monitoring/hard',
      label: '경질 모니터링',
      icon: Monitor,
      active: pathname === '/monitoring/hard'
    },
    {
      href: '/monitoring/soft',
      label: '연질 모니터링', 
      icon: Activity,
      active: pathname === '/monitoring/soft'
    },
    {
      href: '/work-logs',
      label: '작업 로그',
      icon: FileText,
      active: pathname === '/work-logs'
    }
  ]

  return (
    <nav className="bg-gray-900/90 backdrop-blur border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/monitoring/hard" className="text-2xl font-bold text-white">
            정류기 대시보드
          </Link>
          
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    item.active
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
        
        <div className="text-sm text-gray-400">
          실시간 모니터링 시스템
        </div>
      </div>
    </nav>
  )
}
