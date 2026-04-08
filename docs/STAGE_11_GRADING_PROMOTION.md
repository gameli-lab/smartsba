# Stage 11: Grading & Promotion System

## Overview
Stage 11 implements a comprehensive student promotion management system that allows school admins to:
- View class rankings by student scores
- Set individual promotion status (promoted/repeated/withdrawn/pending)
- Define next class for promoted students
- Bulk promote entire classes to next class
- Track promotion history with remarks

## Architecture

### Database
Uses existing tables:
- **classes**: Class structure with level
- **students**: Student records linked to classes
- **scores_assessments**: Aggregated scores for ranking
- **academic_sessions**: Term/year context
- **class_teacher_remarks**: Stores promotion status, next class, and remarks

### Key Relationships
```
academic_sessions (1) ──→ (M) class_teacher_remarks
                              ├─→ students
                              └─→ classes

students (1) ──→ (M) scores_assessments
```

## Components

### 1. **grading-promotion/page.tsx** (Server Page)
- Fetches classes and active sessions via auth
- Renders title and GradingPromotionClient wrapper
- Handles authorization via `requireSchoolAdmin()`

### 2. **GradingPromotionClient** (grading-promotion-client.tsx)
Client component managing:
- Class and session selection dropdowns
- Load promotion data button
- Summary stats: Total Students, Promoted, Pending, Next Class
- Quick bulk promotion action
- PromotionList integration

**Key Features:**
- Error handling with alert display
- Loading states during data fetch
- Bulk promotion with confirmation
- Auto-refresh after bulk action
- Responsive grid layout

### 3. **PromotionList** (promotion-list.tsx)
Table component displaying:
- Rank (sorted by total_score descending)
- Student admission number and full name
- Total score and average score
- Promotion status badge:
  - Green: Promoted
  - Orange: Repeated
  - Red: Withdrawn
  - Gray: Pending
- Action button to edit status

**Interactions:**
- Click edit button → opens PromotionRemarkDialog
- Dialog submit → calls setStudentPromotion
- Refresh triggers parent data reload

### 4. **PromotionRemarkDialog** (promotion-remark-dialog.tsx)
Modal dialog for editing student promotion:
- Status select: promoted | repeated | withdrawn
- Conditional next_class select (only if promoted)
- Remarks textarea for notes
- Form submission to setStudentPromotion
- Error handling and loading state

## Server Actions

### `getClassPromotionData(classId: string, sessionId: string)`
**Purpose:** Fetch ranked students and promotion metadata

**Returns:**
```typescript
{
  success: true,
  data: {
    class: { id, name, level },
    session: { id, academic_year, term },
    students: [
      {
        id, full_name, admission_number,
        rank, total_score, avg_score,
        promotion_status, promotion_remark
      }
    ],
    nextClasses: [{ id, name, level }],
    totalStudents: number,
    promotedCount: number
  }
}
```

**Logic:**
- Fetch class and session records
- Calculate next level for promotion
- Find available classes at next level
- Fetch students with aggregated scores
- Fetch promotion status from class_teacher_remarks
- Sort by score descending, add rank
- Calculate promoted count

### `setStudentPromotion(params: SetPromotionParams): Promise<Result>`
**Purpose:** Update individual student promotion status

**Parameters:**
```typescript
{
  student_id: string,
  session_id: string,
  status: 'promoted' | 'repeated' | 'withdrawn',
  next_class_id?: string,
  remark?: string
}
```

**Logic:**
- Validate student ownership via school_id
- Upsert class_teacher_remarks record
- Only allow next_class if status=promoted
- Update with timestamp and remarks
- Revalidate path

### `bulkPromoteStudents(params: BulkPromoteParams): Promise<Result>`
**Purpose:** Promote entire class to next class

**Parameters:**
```typescript
{
  class_id: string,
  current_session_id: string,
  next_class_id: string,
  student_ids: string[],
  remark: string
}
```

**Logic:**
- Validate class ownership
- Validate next_class ownership
- Batch insert/update class_teacher_remarks
- Set status='promoted' for all
- Set next_class_id for all
- Include remark
- Revalidate path

## User Flow

### View & Edit Individual Status
1. Select class and session
2. Click "Load Data"
3. View ranked student list
4. Click edit button on student row
5. PromotionRemarkDialog opens
6. Select status and (if promoted) next class
7. Add optional remarks
8. Submit
9. List refreshes with updated status

### Bulk Promote Class
1. Select class and session
2. Click "Load Data"
3. Click "Promote Remaining to [NextClass]"
4. Confirm action
5. All students without status are promoted
6. List refreshes showing new promotions

## Data Validation

### Student Ownership
```typescript
// Verify student belongs to school
const { school_id: studentSchoolId } = await supabase
  .from('students')
  .select('school_id')
  .eq('id', student_id)
  .single()

if (studentSchoolId !== schoolId) {
  return { success: false, error: 'Unauthorized' }
}
```

### Class Ownership
```typescript
// Verify both classes belong to school
const classes = await supabase
  .from('classes')
  .select('*')
  .in('id', [class_id, next_class_id])
  
if (!classes.every(c => c.school_id === schoolId)) {
  return { success: false, error: 'Unauthorized' }
}
```

## Status Values

- **promoted**: Student advances to next class
- **repeated**: Student repeats current class
- **withdrawn**: Student leaves the school/class
- **null/pending**: No decision made yet

## Next Class Selection Logic

```typescript
// Available for promotion to next level
const nextLevel = currentClass.level + 1

// Fetch available classes at next level
const nextClasses = await supabase
  .from('classes')
  .select('*')
  .eq('school_id', schoolId)
  .eq('level', nextLevel)
  .order('name')
```

## UI Components Used

- `Button`: Primary action buttons
- `Card`: Container for sections
- `Select`: Dropdown for class/session/status
- `Alert`: Error messages
- `Badge`: Status indicators
- `Table`: Student list with rows
- `Dialog`: Promotion remark modal

## File Structure

```
src/app/(school-admin)/school-admin/grading-promotion/
├── page.tsx                          # Server page
├── grading-promotion-client.tsx      # Main client component
├── promotion-list.tsx                # Student table
├── promotion-remark-dialog.tsx       # Edit dialog
└── actions.ts                        # Server actions
```

## Error Handling

- **Missing class/session**: Alert message on page
- **Network errors**: Caught and displayed in Alert
- **Validation errors**: From server actions
- **Unauthorized access**: Handled by requireSchoolAdmin()

## Performance Considerations

- **Data fetch**: Only on "Load Data" click
- **Sorting**: Done server-side in action
- **Revalidation**: Only affected path (grading-promotion)
- **State management**: Minimal client state

## Future Enhancements

1. **Export to Excel**: Export promotion list with status
2. **Batch import**: Import pre-decided promotions
3. **Rules engine**: Auto-promote based on score thresholds
4. **History view**: See promotion records by year
5. **Approval workflow**: Multi-user promotion approval
6. **PDF reports**: Print promotion lists per class

## Testing Checklist

- [ ] Load data with class/session selection
- [ ] View ranked student list sorted correctly
- [ ] Edit individual student status
- [ ] Status badge changes color correctly
- [ ] Bulk promote class (confirm dialog)
- [ ] Validation prevents unauthorized access
- [ ] Error messages display properly
- [ ] Next class selector shows only next level
- [ ] Remarks textarea captures notes
- [ ] List refreshes after changes
