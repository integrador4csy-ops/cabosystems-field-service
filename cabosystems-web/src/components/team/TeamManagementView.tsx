import { useState } from 'react';
import { Users, Clock } from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';
import { useTranslation } from '../../context/LanguageContext';
import { CollaboratorsSection } from './CollaboratorsSection';
import { InvitationsSection } from './InvitationsSection';
import { InviteUserModal } from './InviteUserModal';
import './TeamManagementView.css';
import type { SectionResources } from '../../context/SectionResources';
import { teamProfiles, teamInvitations } from '../../lib/teamSnapshot';

export const prefetchTeam = (resources: SectionResources, section: string) => section === 'invitaciones'
  ? resources.queries.load('invitations', teamInvitations)
  : resources.queries.load('collaborators', teamProfiles);

interface TeamManagementViewProps {
  onTeamChanged: () => void;
}

export function TeamManagementView({ onTeamChanged }: TeamManagementViewProps) {
  const { activeItem, setActiveItem } = useSidebar();
  const { t } = useTranslation();
  const [invitationRevision, setInvitationRevision] = useState(0);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const sections = [
    { id: 'colaboradores', label: t('sidebar.collaborators'), icon: Users },
    { id: 'invitaciones', label: t('sidebar.invitations'), icon: Clock },
  ];
  const openInvite = () => setIsInviteOpen(true);

  return (
    <section aria-label={t("Gestión de equipo")} className="team-page flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <nav aria-label={t("Secciones de gestión de equipo")} className="flex shrink-0 gap-6 overflow-x-auto border-b border-slate-200 px-5">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={activeItem === id ? 'page' : undefined}
            onClick={() => setActiveItem(id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 py-4 text-sm font-medium transition-colors ${activeItem === id ? 'border-brand-500 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div hidden={activeItem !== 'colaboradores'}>
          <CollaboratorsSection active={activeItem === 'colaboradores'} onOpenInvite={openInvite} onUserListChanged={onTeamChanged} />
        </div>
        <div hidden={activeItem !== 'invitaciones'}>
          <InvitationsSection active={activeItem === 'invitaciones'} refreshVersion={invitationRevision} onOpenInvite={openInvite} />
        </div>
      </div>
      <InviteUserModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onInviteCreated={() => { setInvitationRevision((previous) => previous + 1); onTeamChanged(); }}
      />
    </section>
  );
}
