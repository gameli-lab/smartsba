"use client"

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface PDFExportOptions {
  title: string
  orientation?: 'portrait' | 'landscape'
  data: any[]
  columns: Array<{ header: string; dataKey: string }>
  metadata?: Record<string, string>
}

export async function exportSchoolsToPDF(
  schools: any[],
  filters?: { status?: string; search?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const doc = new jsPDF('landscape')

    // Add title
    doc.setFontSize(18)
    doc.text('Schools Report', 14, 20)

    // Add metadata
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30)
    if (filters?.status && filters.status !== 'all') {
      doc.text(`Status Filter: ${filters.status}`, 14, 36)
    }
    if (filters?.search) {
      doc.text(`Search: ${filters.search}`, 14, 42)
    }

    // Add table
    autoTable(doc, {
      startY: filters?.search || filters?.status !== 'all' ? 48 : 40,
      head: [['Name', 'Email', 'Phone', 'Status', 'Created']],
      body: schools.map((school) => [
        school.name,
        school.email || '-',
        school.phone || '-',
        school.status,
        new Date(school.created_at).toLocaleDateString(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
    })

    // Add footer
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }

    // Save the PDF
    const timestamp = new Date().toISOString().split('T')[0]
    doc.save(`schools_report_${timestamp}.pdf`)

    return { success: true }
  } catch (err) {
    console.error('Error generating PDF:', err)
    return { success: false, error: 'Failed to generate PDF' }
  }
}

export async function exportUsersToPDF(
  users: any[],
  filters?: { role?: string; search?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const doc = new jsPDF('landscape')

    doc.setFontSize(18)
    doc.text('Users Report', 14, 20)

    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30)
    if (filters?.role && filters.role !== 'all') {
      doc.text(`Role Filter: ${filters.role}`, 14, 36)
    }
    if (filters?.search) {
      doc.text(`Search: ${filters.search}`, 14, 42)
    }

    autoTable(doc, {
      startY: filters?.search || filters?.role !== 'all' ? 48 : 40,
      head: [['Name', 'Email', 'Role', 'School', 'Created']],
      body: users.map((user) => [
        user.full_name || '-',
        user.email || '-',
        user.role,
        user.school || '-',
        new Date(user.created_at).toLocaleDateString(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
    })

    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }

    const timestamp = new Date().toISOString().split('T')[0]
    doc.save(`users_report_${timestamp}.pdf`)

    return { success: true }
  } catch (err) {
    console.error('Error generating PDF:', err)
    return { success: false, error: 'Failed to generate PDF' }
  }
}

export async function exportAnalyticsToPDF(
  analytics: {
    totalSchools: number
    activeSchools: number
    inactiveSchools: number
    usersByRole: Record<string, number>
    recentSchools: any[]
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.text('Platform Analytics Report', 14, 20)

    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30)

    // School statistics
    doc.setFontSize(14)
    doc.text('School Statistics', 14, 45)
    doc.setFontSize(10)
    doc.text(`Total Schools: ${analytics.totalSchools}`, 20, 55)
    doc.text(`Active Schools: ${analytics.activeSchools}`, 20, 62)
    doc.text(`Inactive Schools: ${analytics.inactiveSchools}`, 20, 69)

    // User statistics
    doc.setFontSize(14)
    doc.text('User Statistics', 14, 85)
    doc.setFontSize(10)
    let yPos = 95
    Object.entries(analytics.usersByRole).forEach(([role, count]) => {
      doc.text(`${role.replace('_', ' ').toUpperCase()}: ${count}`, 20, yPos)
      yPos += 7
    })

    // Recent schools table
    doc.setFontSize(14)
    doc.text('Recent Schools', 14, yPos + 10)

    autoTable(doc, {
      startY: yPos + 18,
      head: [['Name', 'Status', 'Created']],
      body: analytics.recentSchools.map((school) => [
        school.name,
        school.status,
        new Date(school.created_at).toLocaleDateString(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
    })

    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }

    const timestamp = new Date().toISOString().split('T')[0]
    doc.save(`analytics_report_${timestamp}.pdf`)

    return { success: true }
  } catch (err) {
    console.error('Error generating PDF:', err)
    return { success: false, error: 'Failed to generate PDF' }
  }
}

export async function exportAuditLogsToPDF(
  logs: any[],
  filters?: { actionType?: string; entityType?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const doc = new jsPDF('landscape')

    doc.setFontSize(18)
    doc.text('Audit Logs Report', 14, 20)

    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30)
    if (filters?.actionType && filters.actionType !== 'all') {
      doc.text(`Action Filter: ${filters.actionType}`, 14, 36)
    }
    if (filters?.entityType && filters.entityType !== 'all') {
      doc.text(`Entity Filter: ${filters.entityType}`, 14, 42)
    }

    autoTable(doc, {
      startY: filters?.actionType || filters?.entityType ? 48 : 40,
      head: [['Actor', 'Action', 'Entity Type', 'Entity ID', 'Created']],
      body: logs.map((log) => [
        log.actor_name || 'Unknown',
        log.action_type,
        log.entity_type,
        log.entity_id || '-',
        new Date(log.created_at).toLocaleString(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 8 },
    })

    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }

    const timestamp = new Date().toISOString().split('T')[0]
    doc.save(`audit_logs_report_${timestamp}.pdf`)

    return { success: true }
  } catch (err) {
    console.error('Error generating PDF:', err)
    return { success: false, error: 'Failed to generate PDF' }
  }
}

export async function exportSchoolPerformanceToPDF(
  schools: any[],
  dateRange?: { startDate?: string; endDate?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const doc = new jsPDF('landscape')

    doc.setFontSize(18)
    doc.text('School Performance Report', 14, 20)

    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30)
    if (dateRange?.startDate || dateRange?.endDate) {
      doc.text(
        `Period: ${dateRange.startDate || 'Beginning'} to ${dateRange.endDate || 'Today'}`,
        14,
        36
      )
    }

    // Calculate totals
    const totals = schools.reduce(
      (acc, school) => ({
        students: acc.students + school.total_students,
        teachers: acc.teachers + school.total_teachers,
        classes: acc.classes + school.total_classes,
        activeUsers: acc.activeUsers + school.active_users,
        assessments: acc.assessments + school.assessment_count,
        announcements: acc.announcements + school.announcement_count,
      }),
      { students: 0, teachers: 0, classes: 0, activeUsers: 0, assessments: 0, announcements: 0 }
    )

    // Add summary
    doc.setFontSize(12)
    doc.text('Platform Summary', 14, dateRange ? 46 : 40)
    doc.setFontSize(9)
    const summaryY = dateRange ? 52 : 46
    doc.text(`Total Students: ${totals.students.toLocaleString()}`, 14, summaryY)
    doc.text(`Total Teachers: ${totals.teachers.toLocaleString()}`, 80, summaryY)
    doc.text(`Total Classes: ${totals.classes.toLocaleString()}`, 140, summaryY)
    doc.text(`Active Users: ${totals.activeUsers.toLocaleString()}`, 200, summaryY)

    // Add school comparison table
    autoTable(doc, {
      startY: summaryY + 10,
      head: [['School', 'Status', 'Students', 'Teachers', 'Classes', 'Active Users', 'Assessments', 'Announcements']],
      body: schools.map((school) => [
        school.school_name,
        school.status,
        school.total_students,
        school.total_teachers,
        school.total_classes,
        school.active_users,
        school.assessment_count,
        school.announcement_count,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 8 },
    })

    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }

    const timestamp = new Date().toISOString().split('T')[0]
    doc.save(`school_performance_${timestamp}.pdf`)

    return { success: true }
  } catch (err) {
    console.error('Error generating PDF:', err)
    return { success: false, error: 'Failed to generate PDF' }
  }
}

export async function exportUsageTrendsToPDF(
  trends: any[],
  dateRange?: { startDate?: string; endDate?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const doc = new jsPDF('portrait')

    doc.setFontSize(18)
    doc.text('Usage Trends Report', 14, 20)

    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30)
    if (dateRange?.startDate || dateRange?.endDate) {
      doc.text(
        `Period: ${dateRange.startDate || 'Beginning'} to ${dateRange.endDate || 'Today'}`,
        14,
        36
      )
    }

    // Calculate totals
    const totals = trends.reduce(
      (acc, day) => ({
        activeUsers: acc.activeUsers + day.active_users,
        newSchools: acc.newSchools + day.new_schools,
        newUsers: acc.newUsers + day.new_users,
        totalLogins: acc.totalLogins + day.total_logins,
      }),
      { activeUsers: 0, newSchools: 0, newUsers: 0, totalLogins: 0 }
    )

    // Add summary
    doc.setFontSize(12)
    doc.text('Summary', 14, dateRange ? 46 : 40)
    doc.setFontSize(9)
    const summaryY = dateRange ? 52 : 46
    doc.text(`New Schools: ${totals.newSchools}`, 14, summaryY)
    doc.text(`New Users: ${totals.newUsers}`, 14, summaryY + 6)
    doc.text(`Total Logins: ${totals.totalLogins.toLocaleString()}`, 14, summaryY + 12)
    doc.text(
      `Avg Daily Logins: ${Math.round(totals.totalLogins / (trends.length || 1))}`,
      14,
      summaryY + 18
    )

    // Add trends table
    autoTable(doc, {
      startY: summaryY + 26,
      head: [['Date', 'Active Users', 'New Schools', 'New Users', 'Logins']],
      body: trends.reverse().map((day) => [
        new Date(day.date).toLocaleDateString(),
        day.active_users,
        day.new_schools,
        day.new_users,
        day.total_logins,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
    })

    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }

    const timestamp = new Date().toISOString().split('T')[0]
    doc.save(`usage_trends_${timestamp}.pdf`)

    return { success: true }
  } catch (err) {
    console.error('Error generating PDF:', err)
    return { success: false, error: 'Failed to generate PDF' }
  }
}

export async function exportFeatureAdoptionToPDF(
  features: any[],
  dateRange?: { startDate?: string; endDate?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const doc = new jsPDF('portrait')

    doc.setFontSize(18)
    doc.text('Feature Adoption Report', 14, 20)

    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30)
    if (dateRange?.startDate || dateRange?.endDate) {
      doc.text(
        `Period: ${dateRange.startDate || 'Beginning'} to ${dateRange.endDate || 'Today'}`,
        14,
        36
      )
    }

    // Calculate summary
    const totalUsage = features.reduce((acc, f) => acc + f.usage_count, 0)
    const avgAdoption = features.length > 0
      ? features.reduce((acc, f) => acc + f.adoption_rate, 0) / features.length
      : 0

    // Add summary
    doc.setFontSize(12)
    doc.text('Summary', 14, dateRange ? 46 : 40)
    doc.setFontSize(9)
    const summaryY = dateRange ? 52 : 46
    doc.text(`Features Tracked: ${features.length}`, 14, summaryY)
    doc.text(`Average Adoption Rate: ${avgAdoption.toFixed(1)}%`, 14, summaryY + 6)
    doc.text(`Total Feature Usage: ${totalUsage.toLocaleString()}`, 14, summaryY + 12)

    // Add features table
    autoTable(doc, {
      startY: summaryY + 20,
      head: [['Feature', 'Schools Using', 'Total Schools', 'Adoption Rate', 'Usage Count']],
      body: features.map((feature) => [
        feature.feature_name,
        feature.schools_using,
        feature.total_schools,
        `${feature.adoption_rate.toFixed(1)}%`,
        feature.usage_count.toLocaleString(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
    })

    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }

    const timestamp = new Date().toISOString().split('T')[0]
    doc.save(`feature_adoption_${timestamp}.pdf`)

    return { success: true }
  } catch (err) {
    console.error('Error generating PDF:', err)
    return { success: false, error: 'Failed to generate PDF' }
  }
}
