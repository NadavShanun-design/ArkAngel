import React from 'react';

interface SearchingIndicatorProps {
  toolName: string;
  serviceName: string;
}

// Google Workspace Icons (reused from ToolCallCard)
const GoogleIcons = {
  gmail: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-.904.732-1.636 1.636-1.636h3.819L12 8.73l6.545-4.909h3.819c.904 0 1.636.732 1.636 1.636z"
        fill="#EA4335"
      />
      <path
        d="M12 16.64L1.636 9.273V5.457L12 8.73l10.364-3.273v3.816L12 16.64z"
        fill="#FBBC04"
      />
      <path
        d="M12 16.64l6.545-4.91h3.819v3.816L12 16.64z"
        fill="#34A853"
      />
      <path
        d="M12 16.64L1.636 9.273h3.819L12 16.64z"
        fill="#EA4335"
      />
    </svg>
  ),
  calendar: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="#4285F4" strokeWidth="2" fill="none"/>
      <line x1="16" y1="2" x2="16" y2="6" stroke="#4285F4" strokeWidth="2"/>
      <line x1="8" y1="2" x2="8" y2="6" stroke="#4285F4" strokeWidth="2"/>
      <line x1="3" y1="10" x2="21" y2="10" stroke="#4285F4" strokeWidth="2"/>
      <text x="12" y="16" textAnchor="middle" fontSize="10" fill="#4285F4" fontWeight="bold">31</text>
    </svg>
  ),
  drive: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M7.71 6.5L1.15 17h4.56l6.56-10.5H7.71z"
        fill="#0066DA"
      />
      <path
        d="M16.29 6.5L9.73 17h4.56l6.56-10.5h-4.56z"
        fill="#00A862"
      />
      <path
        d="M22.85 17L16.29 6.5h-4.56L18.29 17h4.56z"
        fill="#EA4335"
      />
    </svg>
  ),
  docs: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="14" height="20" rx="2" ry="2" fill="#4285F4"/>
      <rect x="6" y="6" width="8" height="1" fill="white"/>
      <rect x="6" y="8" width="6" height="1" fill="white"/>
      <rect x="6" y="10" width="8" height="1" fill="white"/>
      <rect x="6" y="12" width="4" height="1" fill="white"/>
    </svg>
  ),
  sheets: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="14" height="20" rx="2" ry="2" fill="#0F9D58"/>
      <rect x="6" y="6" width="8" height="1" fill="white"/>
      <rect x="6" y="8" width="6" height="1" fill="white"/>
      <rect x="6" y="10" width="8" height="1" fill="white"/>
      <rect x="6" y="12" width="4" height="1" fill="white"/>
      <rect x="6" y="14" width="8" height="1" fill="white"/>
    </svg>
  ),
  slides: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="14" height="20" rx="2" ry="2" fill="#F4B400"/>
      <rect x="6" y="6" width="8" height="1" fill="white"/>
      <rect x="6" y="8" width="6" height="1" fill="white"/>
      <rect x="6" y="10" width="8" height="1" fill="white"/>
      <rect x="6" y="12" width="4" height="1" fill="white"/>
    </svg>
  ),
  forms: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="14" height="20" rx="2" ry="2" fill="#673AB7"/>
      <rect x="6" y="6" width="8" height="1" fill="white"/>
      <rect x="6" y="8" width="6" height="1" fill="white"/>
      <rect x="6" y="10" width="8" height="1" fill="white"/>
      <rect x="6" y="12" width="4" height="1" fill="white"/>
    </svg>
  ),
  tasks: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="14" height="20" rx="2" ry="2" fill="#34A853"/>
      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
    </svg>
  ),
  search: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="8" stroke="#4285F4" strokeWidth="2" fill="none"/>
      <path d="m21 21-4.35-4.35" stroke="#4285F4" strokeWidth="2"/>
    </svg>
  ),
  chat: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke="#4285F4"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  )
};

// Get icon for tool name
const getToolIcon = (toolName: string): React.ReactNode => {
  const name = toolName.toLowerCase();
  if (name.includes('gmail') || name.includes('email')) return GoogleIcons.gmail;
  if (name.includes('calendar') || name.includes('event')) return GoogleIcons.calendar;
  if (name.includes('drive') || name.includes('file')) return GoogleIcons.drive;
  if (name.includes('docs') || name.includes('document')) return GoogleIcons.docs;
  if (name.includes('sheets') || name.includes('spreadsheet')) return GoogleIcons.sheets;
  if (name.includes('slides') || name.includes('presentation')) return GoogleIcons.slides;
  if (name.includes('forms') || name.includes('form')) return GoogleIcons.forms;
  if (name.includes('tasks') || name.includes('task')) return GoogleIcons.tasks;
  if (name.includes('search')) return GoogleIcons.search;
  if (name.includes('chat')) return GoogleIcons.chat;
  return GoogleIcons.search; // Default fallback
};

// Get service name for display
const getServiceName = (toolName: string): string => {
  const name = toolName.toLowerCase();
  if (name.includes('gmail') || name.includes('email')) return 'Gmail';
  if (name.includes('calendar') || name.includes('event')) return 'Google Calendar';
  if (name.includes('drive') || name.includes('file')) return 'Google Drive';
  if (name.includes('docs') || name.includes('document')) return 'Google Docs';
  if (name.includes('sheets') || name.includes('spreadsheet')) return 'Google Sheets';
  if (name.includes('slides') || name.includes('presentation')) return 'Google Slides';
  if (name.includes('forms') || name.includes('form')) return 'Google Forms';
  if (name.includes('tasks') || name.includes('task')) return 'Google Tasks';
  if (name.includes('search')) return 'Google Search';
  if (name.includes('chat')) return 'Google Chat';
  return 'Google Workspace';
};

// Animated dots component
const AnimatedDots: React.FC = () => {
  return (
    <div className="flex items-center gap-1">
      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  );
};

export const SearchingIndicator: React.FC<SearchingIndicatorProps> = ({
  toolName,
  serviceName
}) => {
  const icon = getToolIcon(toolName);
  const displayServiceName = serviceName || getServiceName(toolName);

  return (
    <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-sm">
      {/* Service Icon */}
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm border border-blue-100">
        {icon}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">Searching</span>
          <AnimatedDots />
        </div>
        <div className="text-xs text-gray-600 mt-1">
          {displayServiceName}
        </div>
      </div>
    </div>
  );
};



