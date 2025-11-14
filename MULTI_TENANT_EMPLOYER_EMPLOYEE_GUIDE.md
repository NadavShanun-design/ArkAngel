# Multi-Tenant Employer/Employee System - Complete Guide

## Overview

ArkAngel implements a complete multi-tenant employer/employee monitoring system using Supabase with Row-Level Security (RLS) policies. This system allows:

1. **Employers** to create organizations and monitor employee productivity
2. **Employees** to link to organizations and view their own performance data
3. **Complete data isolation** between different organizations
4. **Real-time synchronization** across multiple devices and instances

## System Architecture

### Database Schema

The multi-tenant system uses the following Supabase tables:

1. **organizations** - Stores employer organizations with unique invite codes
2. **users** (profiles) - Extended with role, organization_id, and employer_code fields
3. **screenshots** - Screenshots captured from employee devices
4. **employee_analytics** - Pre-computed analytics for fast dashboard loading

### Row-Level Security (RLS)

All data is protected with RLS policies that ensure:
- Employers can only see employees in their organization
- Employees can only see their own data
- No cross-organization data leakage

## User Flows

### Employer Flow

1. **Sign Up/Sign In**
   - Create account with email/password or sign in as guest
   - User is taken to onboarding

2. **Choose "I'm an Employer"**
   - For email users: Enter organization name
   - For guest users: Organization name is auto-generated (e.g., "Alpha Tech")
   - System creates organization and generates unique employer code (e.g., "EMP-ABC123")
   - User role is set to `'employer'`

3. **View Employer Code**
   - Open Advanced Settings → Profile section
   - See employer code displayed with copy button
   - Share this code with employees

4. **Monitor Employees**
   - Open Advanced Settings → Employees section (only visible to employers)
   - View all employees linked to organization
   - See real-time analytics and screenshots for each employee

### Employee Flow

1. **Sign Up/Sign In**
   - Create account with email/password or sign in as guest
   - User is taken to onboarding

2. **Choose "I'm an Employee"**
   - Enter employer code provided by employer
   - System validates code and links user to organization
   - User role is set to `'employee'`

3. **View Own Performance**
   - Open Advanced Settings → Performance section (only visible to employees)
   - See personal pie chart with software usage analytics
   - View activity timeline and category breakdown
   - Data is private and only visible to the employee and their employer

### Role-Based UI Visibility

The Advanced Settings page dynamically shows/hides sections based on user role:

**Visible to Everyone:**
- Profile
- Angel Profiles
- Notifications
- Actions
- Design
- Agent
- Integrations
- Payments
- Documents
- Transcripts
- Photos
- Training
- Manage Data

**Visible ONLY to Employers:**
- Employees (shows employee monitoring dashboard)

**Visible ONLY to Employees:**
- Performance (shows personal analytics pie chart)

## Key Features

### 1. Employer Code System

- **Format:** `EMP-XXXXXX` (6 characters using A-Z, 2-9, excluding similar-looking chars like 0/O, 1/I)
- **Generation:** Automatic, guaranteed unique
- **Display:** Profile section in Advanced Settings for employers
- **Usage:** Employees enter this code to link to organization

### 2. Organization Management

- One organization per employer
- Employers can have unlimited employees
- Organization data includes:
  - Organization ID (UUID)
  - Employer ID (links to employer user)
  - Organization name
  - Employer code
  - Creation/update timestamps

### 3. Employee Analytics

Analytics are automatically calculated and cached in the `employee_analytics` table:

- **Total screenshots** - Count of all screenshots taken
- **Category breakdown** - Distribution by software category (browsers, code editors, social media, etc.)
- **Timeline** - Daily activity for last 30 days
- **Most used category** - Top category by count

Analytics update automatically via database triggers when new screenshots are inserted.

### 4. Cross-Device Synchronization

The system works seamlessly across multiple devices:

1. **Employer on Computer A** creates organization → gets code `EMP-ABC123`
2. **Employee on Computer B** enters code `EMP-ABC123` → instantly linked
3. Both users see real-time updates via Supabase Realtime subscriptions

## Technical Implementation

### Frontend (React/TypeScript)

**Key Files:**
- `src/components/auth/OnboardingPage.tsx` - Role selection and organization setup
- `src/components/auth/RoleSelectionModal.tsx` - Employer/Employee choice UI
- `src/components/auth/EmployerCodeDisplay.tsx` - Shows employer code after creation
- `src/components/auth/EmployeeCodeInput.tsx` - Allows employee to enter code
- `src/components/advanced/AdvancedSettingsPage.tsx` - Shows employer code in Profile
- `src/components/advanced/PerformancePage.tsx` - Employee analytics dashboard
- `src/components/employees/EmployeesPage.tsx` - Employer monitoring dashboard

**Key Functions:**
- `setupAsEmployer(userId, organizationName)` - Creates organization for employer
- `linkAsEmployee(userId, employerCode)` - Links employee to organization
- `getEmployeeAnalytics(userId)` - Fetches employee analytics from Supabase

### Backend (Supabase/PostgreSQL)

**Key Functions:**

```sql
-- Create organization for employer
public.setup_employer_account(p_user_id UUID, p_org_name TEXT)

-- Link employee to organization
public.link_employee_to_organization(p_user_id UUID, p_employer_code TEXT)

-- Update employee analytics (auto-triggered)
public.update_employee_analytics(target_user_id UUID)
```

**RLS Policies:**

Organizations table:
- `employers_read_own_org` - Employers can read their own organization
- `authenticated_insert_org` - Authenticated users can insert (via functions)

Users table:
- `users_read_own` - Users can read their own profile
- `employers_read_employees` - Employers can read employees in their org

Employee Analytics table:
- `employees_read_own_analytics` - Employees can read their own analytics
- `employers_read_org_analytics` - Employers can read analytics for their employees

## Production Deployment

### Supabase Configuration

1. **Enable Anonymous Auth** (if using guest users)
   - Go to Authentication → Settings
   - Enable "Anonymous sign-ins"

2. **Configure Email Auth** (if using email/password)
   - Go to Authentication → Providers → Email
   - Enable "Confirm email" (recommended for production)
   - Add redirect URLs: `https://yourdomain.com/auth`

3. **Run Migrations**
   ```bash
   # Apply migrations in order
   supabase migration up
   ```

4. **Verify RLS Policies**
   - Check that all tables have RLS enabled
   - Test policies with different user roles

### Environment Variables

Create `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Testing the Multi-Tenant System

### Test Scenario 1: Single Device Testing

1. **Create Employer Account**
   - Sign up with email1@example.com
   - Choose "I'm an Employer"
   - Enter organization name: "Test Company"
   - Note the employer code (e.g., EMP-ABC123)
   - Sign out

2. **Create Employee Account**
   - Sign up with email2@example.com
   - Choose "I'm an Employee"
   - Enter employer code: EMP-ABC123
   - Verify successful linkage

3. **Verify Employer Can See Employee**
   - Sign in as employer (email1@example.com)
   - Go to Advanced Settings → Employees
   - Should see email2@example.com listed

4. **Verify Employee Sees Own Data**
   - Sign in as employee (email2@example.com)
   - Go to Advanced Settings → Performance
   - Should see personal analytics (empty if no screenshots yet)

### Test Scenario 2: Multi-Device Testing

1. **Device A (Employer)**
   - Download and install ArkAngel desktop app
   - Sign up as employer
   - Get employer code

2. **Device B (Employee)**
   - Download and install ArkAngel desktop app
   - Sign up as employee
   - Enter employer code from Device A

3. **Verify Real-Time Sync**
   - On Device B (employee): Use the app, screenshots captured
   - On Device A (employer): See employee appear in monitoring dashboard
   - On Device B (employee): View own analytics in Performance section

### Test Scenario 3: Data Isolation

1. **Create Organization 1**
   - Employer A with Employee A1

2. **Create Organization 2**
   - Employer B with Employee B1

3. **Verify Isolation**
   - Employer A should ONLY see Employee A1
   - Employer B should ONLY see Employee B1
   - Employee A1 should ONLY see own data
   - Employee B1 should ONLY see own data

## Common Issues and Troubleshooting

### Issue: Employer code not showing in Profile

**Cause:** User role is not set to 'employer' or employer_code is null

**Solution:**
- Check `user.role === 'employer'` in AuthContext
- Check `user.employer_code` is not null
- Verify `setup_employer_account` function executed successfully

### Issue: Employee can't link to organization

**Cause:** Invalid employer code or organization doesn't exist

**Solution:**
- Verify employer code is exactly as shown (case-sensitive)
- Check organization exists in Supabase dashboard
- Verify `link_employee_to_organization` function returns success

### Issue: Employer can't see employees

**Cause:** RLS policy blocking access or employee not properly linked

**Solution:**
- Verify RLS policy `employers_read_employees` exists
- Check employee's `organization_id` matches employer's organization
- Check employee's `role` is set to 'employee'

### Issue: Employee analytics showing empty

**Cause:** No screenshots captured yet or analytics not calculated

**Solution:**
- Verify screenshots table has data for user
- Run `update_employee_analytics(user_id)` manually
- Check trigger is enabled on screenshots table

## Security Considerations

1. **RLS Policies**
   - Always test policies with different user roles
   - Never use `SECURITY DEFINER` unless absolutely necessary
   - Audit policies regularly

2. **Employer Code Security**
   - Codes are short (6 chars) for usability
   - Consider implementing code expiration for high-security environments
   - Monitor for suspicious linking attempts

3. **Data Privacy**
   - Employee data is only visible to employee and their employer
   - Screenshots should be encrypted at rest (Supabase Storage)
   - Implement data retention policies

4. **User Permissions**
   - Employees cannot see other employees
   - Employees cannot change their organization
   - Employers cannot modify employee data (read-only)

## Advanced Features (Future Enhancements)

1. **Multiple Employer Codes**
   - Allow employers to generate multiple codes
   - Track which code was used by each employee
   - Revoke individual codes

2. **Team/Department Structure**
   - Add sub-organizations (departments)
   - Allow hierarchical access control
   - Department-level analytics

3. **Employee Invitations**
   - Send email invitations instead of sharing codes
   - Track invitation status
   - Auto-link on signup

4. **Analytics Exports**
   - Export employee data to CSV/PDF
   - Scheduled reports
   - Custom date ranges

## API Reference

### Frontend API

```typescript
// Setup employer account
const { employer_code, organization_id } = await setupAsEmployer(userId, orgName);

// Link employee to organization
const { success, employer_name } = await linkAsEmployee(userId, employerCode);

// Get employee analytics
const analytics = await getEmployeeAnalytics(userId);

// Get organization employees (employers only)
const employees = await getOrganizationEmployees(employerId);
```

### Database Functions

```sql
-- Setup employer
SELECT * FROM public.setup_employer_account(
  'user-uuid',
  'Company Name'
);

-- Link employee
SELECT * FROM public.link_employee_to_organization(
  'user-uuid',
  'EMP-ABC123'
);

-- Update analytics
SELECT public.update_employee_analytics('user-uuid');
```

## Conclusion

The ArkAngel multi-tenant system provides a production-ready, secure, and scalable solution for employer/employee monitoring. With automatic RLS policies, real-time synchronization, and cross-device support, it works seamlessly for organizations of any size.

For support or feature requests, please open an issue on GitHub.
