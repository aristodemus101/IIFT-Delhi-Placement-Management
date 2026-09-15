import React from 'react'
import { PageHeader } from '../components/UI'
import TpoAnalytics from './analytics/TpoAnalytics'

export default function AnalyticsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Analytics" subtitle="TPO Performance" />
      <TpoAnalytics />
    </div>
  )
}
