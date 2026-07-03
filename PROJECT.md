# Project: Exam System Frontend and Backend Optimizations

## Architecture
- Front-end Dashboard pages: `app/examinee/page.tsx`, `app/creator/page.tsx`
- Backend API routes: `app/api/creator/exams/route.ts`, `app/api/creator/exams/generate/route.ts`
- Database access layer: Prisma with SQLite.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Examinee Frontend | Multiple-choice warning notice banner & single-choice auto-advance in online exam panel | none | PLANNED |
| 2 | M2: Exam Creation Optimizations | Title pre-population on standard select and duplicate exam title validation checks in backend routes | none | PLANNED |
| 3 | M3: Build and Verification | Compile codebase and run tests to verify implementation | M1, M2 | PLANNED |

## Interface Contracts
### Creator Dashboard ↔ Exams APIs
- **Exams Save Endpoint (`POST /api/creator/exams`)**:
  - Request parameters: `{ id?: string, title: string, standardId?: string, timeLimit: number, questions: any[] }`
  - Response on success: `{ success: true, message: string, exam: { id: string, title: string, questionCount: number } }`
  - Response on duplicate title / invalid input (400): `{ error: string }`
- **Exams Generate Endpoint (`POST /api/creator/exams/generate`)**:
  - Request parameters: `{ standardId: string, title: string, timeLimit: number, config: any }`
  - Response on success: `{ success: true, message: string, examId: string }`
  - Response on duplicate title / invalid input (400): `{ error: string }`
