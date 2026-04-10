'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { DocumentsView } from '@/components/views/DocumentsView';
import { MemoriesView } from '@/components/views/MemoriesView';
import { GraphView } from '@/components/views/GraphView';
import { AgentsView } from '@/components/views/AgentsView';
import { ModelExplorer } from '@/components/chat/ModelExplorer';
import { useUIStore } from '@/store/uiStore';

export default function Home() {
  const { activeView } = useUIStore();

  const renderView = () => {
    switch (activeView) {
      case 'CHAT':
        return <ChatInterface />;
      case 'AGENTS':
        return <AgentsView />;
      case 'DOCUMENTS':
        return <DocumentsView />;
      case 'MEMORIES':
        return <MemoriesView />;
      case 'GRAPH':
        return <GraphView />;
      default:
        return <ChatInterface />;
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-zinc-950 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 h-full min-w-0">
        <Header />
        <main className="flex-1 relative overflow-hidden flex flex-col">
          {renderView()}
        </main>
      </div>
      {/* Model Explorer modal – rendered at root level to avoid overflow clipping */}
      <ModelExplorer />
    </div>
  );
}
