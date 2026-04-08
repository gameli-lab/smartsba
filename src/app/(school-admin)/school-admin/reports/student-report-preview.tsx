'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Download, X, Printer } from 'lucide-react'
import type { ReportCardData } from '@/types'

interface Props {
  report: ReportCardData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StudentReportPreview({ report, open, onOpenChange }: Props) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!report) return null

  const { school, student, class: klass, session, scores, totals, class_teacher_remark, attendance } = report
  const attendanceData = attendance as { present_days?: number | null; total_days?: number | null } | null

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const handlePrint = () => {
    if (!printRef.current) return
    const printContents = printRef.current.innerHTML
    const win = window.open('', '_blank', 'width=800,height=1000')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Report Card – ${student.user_profile.full_name}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: serif; font-size: 12px; color: #000; background: #fff; }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid #000; padding: 3px 6px; }
            .report-paper { padding: 24px; }
          </style>
        </head>
        <body><div class="report-paper">${printContents}</div></body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  const isSignedUrl = (url?: string | null) =>
    url ? url.startsWith('http://') || url.startsWith('https://') : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto p-0 gap-0">
        {/* Action bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 sticky top-0 z-10">
          <span className="text-sm font-medium text-gray-700">
            Report Card — {student.user_profile.full_name}
          </span>
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print
            </Button>
            <Button size="sm" variant="default">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download PDF
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ─── Paper ─── */}
        <div ref={printRef} className="bg-white p-6 text-black font-serif text-xs leading-snug">

          {/* ── School Header ── */}
          <div className="flex items-center justify-between pb-2 border-b-2 border-black mb-1">
            {/* Logo left */}
            <div className="w-[60px] h-[60px] flex items-center justify-center shrink-0">
              {isSignedUrl(school.logo_url) ? (
                <Image
                  src={school.logo_url!}
                  alt="School Logo"
                  width={60}
                  height={60}
                  className="object-contain w-full h-full"
                  unoptimized
                />
              ) : (
                <div className="w-[60px] h-[60px] rounded-full border border-gray-300 flex items-center justify-center text-[9px] text-gray-400 text-center leading-tight">
                  SCHOOL<br/>LOGO
                </div>
              )}
            </div>

            {/* School name & address */}
            <div className="flex-1 text-center px-3">
              <p className="text-2xl font-extrabold uppercase tracking-wide leading-tight">
                {school.name}
              </p>
              {school.address && (
                <p className="text-sm font-semibold mt-0.5">{school.address}</p>
              )}
              {school.phone && (
                <p className="text-sm font-semibold">TEL: {school.phone}</p>
              )}
            </div>

            {/* Stamp right */}
            <div className="w-[60px] h-[60px] flex items-center justify-center shrink-0">
              {isSignedUrl(school.stamp_url) ? (
                <Image
                  src={school.stamp_url!}
                  alt="School Stamp"
                  width={60}
                  height={60}
                  className="object-contain w-full h-full"
                  unoptimized
                />
              ) : (
                <div className="w-[60px] h-[60px] rounded-full border border-gray-300 flex items-center justify-center text-[9px] text-gray-400 text-center leading-tight">
                  SCHOOL<br/>STAMP
                </div>
              )}
            </div>
          </div>

          {/* ── "STUDENT REPORT SHEET" banner ── */}
          <div className="bg-[#1a3a6b] text-white text-center py-1 mb-2">
            <span className="font-bold text-sm tracking-[0.2em] uppercase">Student Report Sheet</span>
          </div>

          {/* ── Student Info Table ── */}
          <table className="w-full border-collapse mb-2 text-[11px]">
            <tbody>
              {/* Row 1: Name + Total Score */}
              <tr>
                <td className="border border-black px-2 py-[3px] font-bold whitespace-nowrap w-[60px]">Name:</td>
                <td className="border border-black px-2 py-[3px] font-semibold" colSpan={4}>
                  {student.user_profile.full_name}
                </td>
                <td className="border border-black px-2 py-[3px] font-bold whitespace-nowrap w-[90px]">Total Score:</td>
                <td className="border border-black px-2 py-[3px] font-bold text-center w-[50px]">
                  {totals.grand_total || ''}
                </td>
              </tr>
              {/* Row 2: Class + Term + Total Exam Score */}
              <tr>
                <td className="border border-black px-2 py-[3px] font-bold">Class:</td>
                <td className="border border-black px-2 py-[3px] font-semibold">{klass.name}</td>
                <td className="border border-black px-2 py-[3px] font-bold text-center whitespace-nowrap">Term</td>
                <td className="border border-black px-2 py-[3px] font-semibold text-center w-[30px]">
                  {session.term}
                </td>
                <td className="border border-black px-2 py-[3px] font-bold whitespace-nowrap w-[110px]" colSpan={2}>
                  Total Exam Score:
                </td>
                <td className="border border-black px-2 py-[3px] font-bold text-center">
                  {totals.total_exam || ''}
                </td>
              </tr>
              {/* Row 3: Positions + Aggregate */}
              <tr>
                <td className="border border-black px-2 py-[3px] font-bold text-center whitespace-nowrap" colSpan={1}>Class Pos</td>
                <td className="border border-black px-2 py-[3px] font-bold text-center">
                  {totals.position > 0 ? totals.position : ''}
                </td>
                <td className="border border-black px-2 py-[3px] font-bold text-center whitespace-nowrap">Overall Pos</td>
                <td className="border border-black px-2 py-[3px] font-bold text-center">
                  {totals.out_of > 0 ? totals.out_of : ''}
                </td>
                <td className="border border-black px-2 py-[3px] font-bold text-center" colSpan={2}>Agg</td>
                <td className="border border-black px-2 py-[3px] font-extrabold text-center text-red-700">
                  {totals.aggregate > 0 ? totals.aggregate : ''}
                </td>
              </tr>
              {/* Row 4: Vacation + Reopening */}
              <tr>
                <td className="border border-black px-2 py-[3px] font-bold text-center" colSpan={1}>Vacation</td>
                <td className="border border-black px-2 py-[3px] text-center font-semibold" colSpan={2}>
                  {formatDate(session.vacation_date)}
                </td>
                <td className="border border-black px-2 py-[3px] font-bold text-center whitespace-nowrap" colSpan={1}>Reopening</td>
                <td className="border border-black px-2 py-[3px] text-center font-semibold" colSpan={3}>
                  {formatDate(session.reopening_date)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Subject Scores Table ── */}
          <table className="w-full border-collapse mb-2 text-[11px]">
            <thead>
              <tr className="bg-[#ddeeff]">
                <th className="border border-black px-2 py-[4px] text-left font-bold">Subject</th>
                <th className="border border-black px-2 py-[4px] text-center font-bold w-[40px]">CAT</th>
                <th className="border border-black px-2 py-[4px] text-center font-bold w-[70px]">Exam Score</th>
                <th className="border border-black px-2 py-[4px] text-center font-bold w-[70px]">Total Score</th>
                <th className="border border-black px-2 py-[4px] text-center font-bold w-[45px]">Grade</th>
                <th className="border border-black px-2 py-[4px] text-left font-bold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {scores.length > 0 ? (
                scores.map((score) => (
                  <tr key={score.id} style={{ backgroundColor: '#fffff0' }}>
                    <td className="border border-black px-2 py-[3px]">{score.subject.name}</td>
                    <td className="border border-black px-2 py-[3px] text-center">
                      {score.ca_score ?? ''}
                    </td>
                    <td className="border border-black px-2 py-[3px] text-center">
                      {score.exam_score ?? ''}
                    </td>
                    <td className="border border-black px-2 py-[3px] text-center font-semibold">
                      {score.total_score ?? ''}
                    </td>
                    <td className="border border-black px-2 py-[3px] text-center font-bold">
                      {score.grade ?? ''}
                    </td>
                    <td className="border border-black px-2 py-[3px]">
                      {score.subject_remark ?? ''}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="border border-black px-2 py-3 text-center text-gray-400 italic">
                    No scores recorded for this session
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ── Attendance & Interest/Attitude ── */}
          <table className="w-full border-collapse mb-2 text-[11px]">
            <tbody>
              <tr>
                <td className="border border-black px-2 py-[3px] font-bold w-[80px]">Attendance</td>
                <td className="border border-black px-2 py-[3px] text-center w-[40px]">
                  {attendanceData?.present_days ?? ''}
                </td>
                <td className="border border-black px-2 py-[3px] font-bold text-center w-[50px]">out of</td>
                <td className="border border-black px-2 py-[3px] text-center w-[40px]">
                  {attendanceData?.total_days ?? ''}
                </td>
                <td className="border border-black px-2 py-[3px] font-bold w-[60px]">Remarks</td>
                <td className="border border-black px-2 py-[3px] font-bold text-center uppercase">
                  {class_teacher_remark?.promotion_status ?? ''}
                </td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-[3px] font-bold">Interest</td>
                <td className="border border-black px-2 py-[3px]" colSpan={2}></td>
                <td className="border border-black px-2 py-[3px] font-bold">Attitude</td>
                <td className="border border-black px-2 py-[3px]" colSpan={2}></td>
              </tr>
            </tbody>
          </table>

          {/* ── Classteacher's Remarks ── */}
          <table className="w-full border-collapse mb-2 text-[11px]">
            <tbody>
              <tr>
                <td className="border border-black px-2 py-[3px] font-bold align-top whitespace-nowrap w-[130px]">
                  Classteacher&apos;s Remarks:
                </td>
                <td className="border border-black px-2 py-[3px] h-[36px] align-top">
                  {class_teacher_remark?.remark ?? ''}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Headteacher's Signature ── */}
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              <tr>
                <td className="border border-black px-2 py-[3px] font-bold align-middle whitespace-nowrap w-[130px]">
                  Headteacher&apos;s Signature:
                </td>
                <td className="border border-black px-2 py-2 h-[52px] text-center align-middle">
                  {isSignedUrl(school.head_signature_url) ? (
                    <Image
                      src={school.head_signature_url!}
                      alt="Headteacher Signature"
                      width={160}
                      height={48}
                      className="mx-auto object-contain max-h-[44px]"
                      unoptimized
                    />
                  ) : (
                    <span className="text-gray-400 italic text-[10px]">
                      {school.head_signature_url ? 'Signature unavailable' : 'No signature uploaded'}
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

        </div>{/* end paper */}
      </DialogContent>
    </Dialog>
  )
}
