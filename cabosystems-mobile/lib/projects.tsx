import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getMyProjects } from './api';
import { useAuth } from './auth';
import { Platform } from 'react-native';
import { cacheFieldProjects, readFieldProjects } from './fieldOutboxStore';
import type { Project } from '@/types/database';

interface ProjectsContextType {
  projects: Project[];
  selectedProject: Project | null;
  selectedProjectId: string | undefined;
  setSelectedProject: (project: Project) => void;
  setSelectedProjectId: (id: string) => void;
  loading: boolean;
  refreshProjects: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType>({
  projects: [],
  selectedProject: null,
  selectedProjectId: undefined,
  setSelectedProject: () => {},
  setSelectedProjectId: () => {},
  loading: false,
  refreshProjects: async () => {},
});

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const owner = session?.user.id || '';
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const requestRef = useRef(0);
  const [dataOwner, setDataOwner] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const refreshProjects = useCallback(async () => {
    if (!owner) return;
    const request = ++requestRef.current;
    const current = () => mountedRef.current && ownerRef.current === owner && requestRef.current === request;
    setLoading(true);
    try {
      if (Platform.OS !== 'web') {
        const cached = await readFieldProjects(owner).catch(() => []);
        if (current() && cached.length) {
          setProjects(cached); setDataOwner(owner);
          setSelectedProjectIdState(previous => cached.some(project => project.id === previous) ? previous : cached[0]?.id);
        }
      }
      if (!current()) return;
      const data = await getMyProjects();
      if (!current()) return;
      setProjects(data);
      setDataOwner(owner);
      if (Platform.OS !== 'web') void cacheFieldProjects(owner, data).catch(() => {});
      setSelectedProjectIdState((prev) => {
        if (prev && data.some((p) => p.id === prev)) return prev;
        return data[0]?.id;
      });
    } catch (err) {
      console.warn('Error fetching projects in ProjectsProvider:', err);
    } finally {
      if (current()) setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    mountedRef.current = true;
    setProjects([]); setDataOwner(''); setSelectedProjectIdState(undefined);
    if (owner) {
      refreshProjects();
    } else {
      setProjects([]);
      setSelectedProjectIdState(undefined);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [owner, refreshProjects]);

  const visibleProjects = dataOwner === owner ? projects : [];
  const selectedProject = visibleProjects.find((p) => p.id === selectedProjectId) ?? visibleProjects[0] ?? null;

  const setSelectedProject = useCallback((project: Project) => {
    setSelectedProjectIdState(project.id);
  }, []);

  const setSelectedProjectId = useCallback((id: string) => {
    setSelectedProjectIdState(id);
  }, []);

  const contextValue = useMemo(
    () => ({
      projects: visibleProjects,
      selectedProject,
      selectedProjectId,
      setSelectedProject,
      setSelectedProjectId,
      loading,
      refreshProjects,
    }),
    [
      visibleProjects,
      selectedProject,
      selectedProjectId,
      setSelectedProject,
      setSelectedProjectId,
      loading,
      refreshProjects,
    ]
  );

  return (
    <ProjectsContext.Provider value={contextValue}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  return useContext(ProjectsContext);
}
