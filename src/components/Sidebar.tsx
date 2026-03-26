import React, { useState } from 'react';
import {
  FileText,
  Users,
  Zap,
  HelpCircle,
  CheckSquare,
  Calendar,
  DollarSign,
  BookOpen,
  Briefcase,
  ClipboardList,
  Eye,
  Home,
  Menu,
  X,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(true);

  const menuSections = [
    {
      label: 'Core',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'vision', label: 'Vision', icon: Eye },
      ],
    },
    {
      label: 'Project',
      items: [
        { id: 'drawings', label: 'Drawings', icon: FileText },
        { id: 'schedule', label: 'Schedule', icon: Calendar },
        { id: 'budget', label: 'Budget', icon: DollarSign },
      ],
    },
    {
      label: 'Field',
      items: [
        { id: 'daily-log', label: 'Daily Log', icon: BookOpen },
        { id: 'field-capture', label: 'Field Capture', icon: Briefcase },
        { id: 'punch-list', label: 'Punch List', icon: CheckSquare },
      ],
    },
    {
      label: 'People & Teams',
      items: [
        { id: 'crews', label: 'Crews', icon: Users },
        { id: 'directory', label: 'Directory', icon: Briefcase },
      ],
    },
    {
      label: 'Documents',
      items: [
        { id: 'rfis', label: 'RFIs', icon: HelpCircle, badge: 23 },
        { id: 'submittals', label: 'Submittals', icon: ClipboardList },
        { id: 'meetings', label: 'Meetings', icon: Users },
        { id: 'files', label: 'Files', icon: FileText },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { id: 'copilot', label: 'AI Copilot', icon: Zap },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Toggle - Hidden on desktop, shown via media queries in CSS */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          top: spacing.lg,
          left: spacing.lg,
          zIndex: 1000,
          background: colors.primaryOrange,
          border: 'none',
          color: colors.white,
          padding: spacing.sm,
          borderRadius: borderRadius.md,
          cursor: 'pointer',
          display: 'none',
        }}
        className="sidebar-mobile-toggle"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: isOpen ? '260px' : '0',
          backgroundColor: colors.darkNavy,
          color: colors.white,
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: `width ${transitions.base}`,
          zIndex: 100,
          borderRight: `1px solid rgba(255, 255, 255, 0.1)`,
        } as React.CSSProperties}
      >
        {/* Logo */}
        <div
          style={{
            padding: spacing.xl,
            borderBottom: `1px solid rgba(255, 255, 255, 0.1)`,
            display: 'flex',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.amber} 100%)`,
              borderRadius: borderRadius.md,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 'bold',
              color: colors.white,
              transform: 'rotate(45deg)',
            }}
          >
            <span style={{ transform: 'rotate(-45deg)' }}>S</span>
          </div>
          <div>
            <p
              style={{
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
                margin: 0,
              }}
            >
              SiteSync
            </p>
            <p
              style={{
                fontSize: typography.fontSize.xs,
                color: 'rgba(255, 255, 255, 0.6)',
                margin: 0,
              }}
            >
              AI
            </p>
          </div>
        </div>

        {/* Menu Items */}
        <nav style={{ padding: `${spacing.lg} 0` }}>
          {menuSections.map((section) => (
            <div key={section.label} style={{ marginBottom: spacing.lg }}>
              <p
                style={{
                  fontSize: typography.fontSize.xs,
                  fontWeight: typography.fontWeight.semibold,
                  color: 'rgba(255, 255, 255, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: `0 ${spacing.lg}`,
                  marginBottom: spacing.sm,
                  margin: 0,
                }}
              >
                {section.label}
              </p>

              {section.items.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: `${spacing.md} ${spacing.lg}`,
                      backgroundColor: isActive ? colors.primaryOrange : 'transparent',
                      border: 'none',
                      color: colors.white,
                      cursor: 'pointer',
                      fontSize: typography.fontSize.base,
                      fontFamily: typography.fontFamily,
                      fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.normal,
                      transition: `background-color ${transitions.fast}`,
                      borderLeft: isActive ? `4px solid ${colors.amber}` : '4px solid transparent',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <IconComponent size={18} />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          backgroundColor: colors.red,
                          borderRadius: borderRadius.full,
                          padding: `2px 6px`,
                          fontSize: typography.fontSize.xs,
                          fontWeight: typography.fontWeight.bold,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Project Selector */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: spacing.lg,
            borderTop: `1px solid rgba(255, 255, 255, 0.1)`,
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <p
            style={{
              fontSize: typography.fontSize.xs,
              color: 'rgba(255, 255, 255, 0.5)',
              margin: 0,
              marginBottom: spacing.sm,
              textTransform: 'uppercase',
            }}
          >
            Active Project
          </p>
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              padding: spacing.md,
              borderRadius: borderRadius.md,
              cursor: 'pointer',
              transition: `background-color ${transitions.fast}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <p
              style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                margin: 0,
                marginBottom: spacing.xs,
              }}
            >
              Meridian Tower
            </p>
            <p
              style={{
                fontSize: typography.fontSize.xs,
                color: colors.tealSuccess,
                margin: 0,
              }}
            >
              62% Complete
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 99,
            display: 'none',
          }}
        />
      )}
    </>
  );
};
