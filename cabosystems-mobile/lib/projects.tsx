import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getMyProjects } from './api';
import { useAuth } from './auth';
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const refreshProjects = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await getMyProjects();
      if (!mountedRef.current) return;
      setProjects(data);
      setSelectedProjectIdState((prev) => {
        if (prev && data.some((p) => p.id === prev)) return prev;
        return data[0]?.id;
      });
    } catch (err) {
      console.warn('Error fetching projects in ProjectsProvider:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    mountedRef.current = true;
    if (session) {
      refreshProjects();
    } else {
      setProjects([]);
      setSelectedProjectIdState(undefined);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [session, refreshProjects]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null;

  const setSelectedProject = useCallback((project: Project) => {
    setSelectedProjectIdState(project.id);
  }, []);

  const setSelectedProjectId = useCallback((id: string) => {
    setSelectedProjectIdState(id);
  }, []);

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        selectedProject,
        selectedProjectId,
        setSelectedProject,
        setSelectedProjectId,
        loading,
        refreshProjects,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  return useContext(ProjectsContext);
}
