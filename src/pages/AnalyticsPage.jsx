import React, { useState } from 'react'
import { PageHeader, TabBar } from '../components/UI'
import { useAuth } from '../lib/AuthContext'
import TpoAnalytics from './analytics/TpoAnalytics'
import PlacementTrends from './analytics/PlacementTrends'

export default function AnalyticsPage() {
  const { isFacultyCoordinator } = useAuth()
  // Faculty coordinators only see TPO Performance — single source for both
  // the tab list and the render guard below, so they can't drift apart.
  const canSeeTrends = !isFacultyCoordinator
  const [activeTab, setActiveTab] = useState('tpo')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="Analytics"
        subtitle={activeTab === 'trends' ? 'Placement Trends' : 'TPO Performance'}
      />

      <TabBar
        tabs={[
          { key: 'tpo', label: 'TPO Performance' },
          canSeeTrends && { key: 'trends', label: 'Placement Trends' },
        ].filter(Boolean)}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'tpo' && <TpoAnalytics />}
      {activeTab === 'trends' && canSeeTrends && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <PlacementTrends />
        </div>
      )}
    </div>
  )
}
