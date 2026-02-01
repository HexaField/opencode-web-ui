import { Task } from '../../types'
import TaskDescription from './TaskDescription'

interface Props {
  plan: Task
  onUpdateDescription: (id: string, description: string) => Promise<void>
  onCreateIssueFromItem: (title: string) => Promise<Task>
  onOpenIssue: (id: string) => void
}

export default function PlanDocument(props: Props) {
  return (
    <div class="h-full w-full overflow-auto bg-white p-6 dark:bg-[#0d1117]">
      <h1 class="mb-6 text-3xl font-bold text-gray-900 dark:text-gray-100">{props.plan.title}</h1>
      <TaskDescription
        task={props.plan}
        onUpdateDescription={props.onUpdateDescription}
        onCreateIssueFromItem={props.onCreateIssueFromItem}
        onOpenIssue={props.onOpenIssue}
      />
    </div>
  )
}
