"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export type WorkspaceSnapshot = {
  orderSheet?: string;
  meta?: unknown;
  preprocess?: unknown;
  blocks?: unknown;
  warnings?: string[];
  engine?: unknown;
};

export type FeedbackOpenTab = "chat" | "report" | null;

type FeedbackContextValue = {
  workspaceSnapshot: WorkspaceSnapshot | null;
  setWorkspaceSnapshot: (data: WorkspaceSnapshot | null) => void;
  openFeedbackTo: (tab: FeedbackOpenTab) => void;
  feedbackOpen: boolean;
  feedbackTab: FeedbackOpenTab;
  setFeedbackOpen: (open: boolean) => void;
  setFeedbackTab: (tab: FeedbackOpenTab) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [workspaceSnapshot, setWorkspaceSnapshotState] = useState<WorkspaceSnapshot | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTab, setFeedbackTab] = useState<FeedbackOpenTab>(null);

  const setWorkspaceSnapshot = useCallback((data: WorkspaceSnapshot | null) => {
    setWorkspaceSnapshotState(data);
  }, []);

  const openFeedbackTo = useCallback((tab: FeedbackOpenTab) => {
    setFeedbackTab(tab);
    setFeedbackOpen(true);
  }, []);

  return (
    <FeedbackContext.Provider
      value={{
        workspaceSnapshot,
        setWorkspaceSnapshot,
        openFeedbackTo,
        feedbackOpen,
        feedbackTab,
        setFeedbackOpen,
        setFeedbackTab,
      }}
    >
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedbackContext() {
  const ctx = useContext(FeedbackContext);
  return (
    ctx ?? {
      workspaceSnapshot: null,
      setWorkspaceSnapshot: () => {},
      openFeedbackTo: () => {},
      feedbackOpen: false,
      feedbackTab: null,
      setFeedbackOpen: () => {},
      setFeedbackTab: () => {},
    }
  );
}
