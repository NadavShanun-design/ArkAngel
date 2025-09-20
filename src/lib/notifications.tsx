import toast from 'react-hot-toast';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ToolActivity } from '@/types';

// Google Workspace URL generators
const generateGoogleUrls = {
  gmail: {
    compose: () => 'https://mail.google.com/mail/u/0/#compose',
    inbox: () => 'https://mail.google.com/mail/u/0/#inbox',
    sent: () => 'https://mail.google.com/mail/u/0/#sent',
    search: (query?: string) => query 
      ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(query)}`
      : 'https://mail.google.com/mail/u/0/#inbox'
  },
  calendar: {
    main: () => 'https://calendar.google.com/calendar/u/0/r',
    event: (eventId?: string) => eventId 
      ? `https://calendar.google.com/calendar/u/0/r/eventedit/${eventId}`
      : 'https://calendar.google.com/calendar/u/0/r',
    create: () => 'https://calendar.google.com/calendar/u/0/r/eventedit'
  },
  drive: {
    main: () => 'https://drive.google.com/drive/u/0/my-drive',
    file: (fileId?: string) => fileId 
      ? `https://drive.google.com/file/d/${fileId}/view`
      : 'https://drive.google.com/drive/u/0/my-drive',
    folder: (folderId?: string) => folderId 
      ? `https://drive.google.com/drive/u/0/folders/${folderId}`
      : 'https://drive.google.com/drive/u/0/my-drive'
  },
  docs: {
    main: () => 'https://docs.google.com/document/u/0/',
    doc: (docId?: string) => docId 
      ? `https://docs.google.com/document/d/${docId}/edit`
      : 'https://docs.google.com/document/u/0/'
  },
  sheets: {
    main: () => 'https://docs.google.com/spreadsheets/u/0/',
    sheet: (sheetId?: string) => sheetId 
      ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
      : 'https://docs.google.com/spreadsheets/u/0/'
  },
  slides: {
    main: () => 'https://docs.google.com/presentation/u/0/',
    presentation: (presentationId?: string) => presentationId 
      ? `https://docs.google.com/presentation/d/${presentationId}/edit`
      : 'https://docs.google.com/presentation/u/0/'
  },
  forms: {
    main: () => 'https://docs.google.com/forms/u/0/',
    form: (formId?: string) => formId 
      ? `https://docs.google.com/forms/d/${formId}/edit`
      : 'https://docs.google.com/forms/u/0/'
  },
  tasks: {
    main: () => 'https://tasks.google.com/embed/?origin=https://calendar.google.com&fullWidth=1'
  }
};

// Extract relevant IDs from tool output
const extractIds = (output: any): { [key: string]: string } => {
  const ids: { [key: string]: string } = {};
  
  if (!output) return ids;
  
  try {
    // Handle string output (JSON)
    const data = typeof output === 'string' ? JSON.parse(output) : output;
    
    // Extract common ID patterns
    if (data.id) ids.id = data.id;
    if (data.eventId) ids.eventId = data.eventId;
    if (data.fileId) ids.fileId = data.fileId;
    if (data.folderId) ids.folderId = data.folderId;
    if (data.documentId) ids.documentId = data.documentId;
    if (data.spreadsheetId) ids.spreadsheetId = data.spreadsheetId;
    if (data.presentationId) ids.presentationId = data.presentationId;
    if (data.formId) ids.formId = data.formId;
    
    // Handle nested objects
    if (data.event?.id) ids.eventId = data.event.id;
    if (data.file?.id) ids.fileId = data.file.id;
    if (data.document?.documentId) ids.documentId = data.document.documentId;
    
  } catch (e) {
    console.warn('Failed to extract IDs from tool output:', e);
  }
  
  return ids;
};

// Generate notification content and URLs based on tool activity
export const generateNotificationContent = (activity: ToolActivity): {
  title: string;
  message: string;
  url: string;
  icon: string;
} | null => {
  const { name, input, output } = activity;
  const ids = extractIds(output);
  
  // Gmail actions
  if (name.includes('gmail') || name.includes('email')) {
    if (name.includes('send') || name.includes('compose')) {
      return {
        title: '✉️ Email Sent',
        message: `Email sent successfully${input?.subject ? ` - ${input.subject}` : ''}`,
        url: generateGoogleUrls.gmail.sent(),
        icon: '✉️'
      };
    }
    if (name.includes('read') || name.includes('get') || name.includes('search')) {
      const query = input?.query || input?.q;
      return {
        title: '📧 Gmail Search',
        message: 'Gmail messages retrieved successfully',
        url: generateGoogleUrls.gmail.search(query),
        icon: '📧'
      };
    }
  }
  
  // Calendar actions
  if (name.includes('calendar') || name.includes('event')) {
    if (name.includes('create') || name.includes('schedule')) {
      return {
        title: '📅 Event Created',
        message: `Calendar event created${input?.summary ? ` - ${input.summary}` : ''}`,
        url: generateGoogleUrls.calendar.event(ids.eventId || ids.id),
        icon: '📅'
      };
    }
    if (name.includes('list') || name.includes('get')) {
      return {
        title: '📆 Calendar Events',
        message: 'Calendar events retrieved successfully',
        url: generateGoogleUrls.calendar.main(),
        icon: '📆'
      };
    }
    if (name.includes('modify') || name.includes('update')) {
      return {
        title: '📝 Event Updated',
        message: `Calendar event updated${input?.summary ? ` - ${input.summary}` : ''}`,
        url: generateGoogleUrls.calendar.event(ids.eventId || ids.id),
        icon: '📝'
      };
    }
  }
  
  // Drive actions
  if (name.includes('drive') || name.includes('file')) {
    if (name.includes('upload') || name.includes('create')) {
      return {
        title: '📁 File Uploaded',
        message: `File uploaded to Google Drive${input?.name ? ` - ${input.name}` : ''}`,
        url: generateGoogleUrls.drive.file(ids.fileId || ids.id),
        icon: '📁'
      };
    }
    if (name.includes('list') || name.includes('search')) {
      return {
        title: '🔍 Drive Search',
        message: 'Drive files retrieved successfully',
        url: generateGoogleUrls.drive.main(),
        icon: '🔍'
      };
    }
  }
  
  // Docs actions
  if (name.includes('docs') || name.includes('document')) {
    if (name.includes('create')) {
      return {
        title: '📄 Document Created',
        message: `Google Doc created${input?.title ? ` - ${input.title}` : ''}`,
        url: generateGoogleUrls.docs.doc(ids.documentId || ids.id),
        icon: '📄'
      };
    }
    if (name.includes('modify') || name.includes('update') || name.includes('batch_update')) {
      return {
        title: '✏️ Document Updated',
        message: 'Google Doc updated successfully',
        url: generateGoogleUrls.docs.doc(ids.documentId || ids.id),
        icon: '✏️'
      };
    }
  }
  
  // Sheets actions
  if (name.includes('sheets') || name.includes('spreadsheet')) {
    if (name.includes('create')) {
      return {
        title: '📊 Spreadsheet Created',
        message: `Google Sheet created${input?.title ? ` - ${input.title}` : ''}`,
        url: generateGoogleUrls.sheets.sheet(ids.spreadsheetId || ids.id),
        icon: '📊'
      };
    }
    if (name.includes('modify') || name.includes('update') || name.includes('values')) {
      return {
        title: '📈 Spreadsheet Updated',
        message: 'Google Sheet updated successfully',
        url: generateGoogleUrls.sheets.sheet(ids.spreadsheetId || ids.id),
        icon: '📈'
      };
    }
    if (name.includes('read') || name.includes('get')) {
      return {
        title: '📋 Spreadsheet Data',
        message: 'Spreadsheet data retrieved successfully',
        url: generateGoogleUrls.sheets.sheet(ids.spreadsheetId || ids.id),
        icon: '📋'
      };
    }
  }
  
  // Slides actions
  if (name.includes('slides') || name.includes('presentation')) {
    if (name.includes('create')) {
      return {
        title: '🖼️ Presentation Created',
        message: `Google Slides created${input?.title ? ` - ${input.title}` : ''}`,
        url: generateGoogleUrls.slides.presentation(ids.presentationId || ids.id),
        icon: '🖼️'
      };
    }
  }
  
  // Forms actions
  if (name.includes('forms') || name.includes('form')) {
    if (name.includes('create')) {
      return {
        title: '📝 Form Created',
        message: `Google Form created${input?.title ? ` - ${input.title}` : ''}`,
        url: generateGoogleUrls.forms.form(ids.formId || ids.id),
        icon: '📝'
      };
    }
  }
  
  // Tasks actions
  if (name.includes('tasks') || name.includes('task')) {
    if (name.includes('create') || name.includes('insert')) {
      return {
        title: '✅ Task Created',
        message: `Task created${input?.title ? ` - ${input.title}` : ''}`,
        url: generateGoogleUrls.tasks.main(),
        icon: '✅'
      };
    }
    if (name.includes('list') || name.includes('get')) {
      return {
        title: '📋 Tasks Retrieved',
        message: 'Tasks retrieved successfully',
        url: generateGoogleUrls.tasks.main(),
        icon: '📋'
      };
    }
  }
  
  // Search actions
  if (name.includes('search')) {
    return {
      title: '🔍 Search Completed',
      message: `Search completed${input?.query ? ` for "${input.query}"` : ''}`,
      url: 'https://www.google.com/search?q=' + encodeURIComponent(input?.query || input?.q || ''),
      icon: '🔍'
    };
  }
  
  return null;
};

// Custom toast component with external link button
const NotificationToast = ({ 
  title, 
  message, 
  url, 
  icon 
}: { 
  title: string; 
  message: string; 
  url: string; 
  icon: string; 
}) => (
  <div className="flex items-start gap-3 p-2">
    <div className="text-lg">{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{message}</div>
      <button
        onClick={async () => {
          try {
            await openUrl(url);
            toast.dismiss();
          } catch (error) {
            console.error('Failed to open URL:', error);
          }
        }}
        className="mt-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
      >
        Open in Browser →
      </button>
    </div>
  </div>
);

// Show notification for completed tool activity
export const showGoogleWorkspaceNotification = (activity: ToolActivity) => {
  // Only show notifications for completed activities
  if (activity.status !== 'complete') return;
  
  const content = generateNotificationContent(activity);
  if (!content) return;
  
  // Show custom toast with external link
  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-card shadow-lg rounded-lg pointer-events-auto border border-border`}
      >
        <NotificationToast {...content} />
      </div>
    ),
    {
      duration: 8000, // Longer duration for action notifications
      position: 'top-right',
    }
  );
};

// Utility function to open external links
export const openExternalLink = async (url: string) => {
  try {
    await openUrl(url);
  } catch (error) {
    console.error('Failed to open external link:', error);
    // Fallback: show error toast
    toast.error('Failed to open link in browser');
  }
};
