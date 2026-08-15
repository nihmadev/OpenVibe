import type { Story } from "@ladle/react";
import { PipelineDashboard, RepositoryDashboard, RuntimeDashboard } from "./examples/DashboardExamples";

export const Runtime: Story = () => <RuntimeDashboard />;
export const Repository: Story = () => <RepositoryDashboard />;
export const Pipeline: Story = () => <PipelineDashboard />;
