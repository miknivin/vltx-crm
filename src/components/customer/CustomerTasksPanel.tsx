/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React from "react";
import { toast } from "react-toastify";
import { TaskItem, TaskStatus, useUpdateTaskMutation } from "@/app/redux/api/contactApi";
import CardSwiper from "@/components/ui/swiper/CardSwiper";
import TaskCard from "@/components/pipeline/TaskCard";

interface CustomerTasksPanelProps {
  tasks: TaskItem[];
}

/// Tasks live on an enquiry, not a customer directly, so this aggregates
/// across every enquiry the customer has on file. Read-only here — creating
/// or editing a task happens from the specific enquiry it belongs to.
export default function CustomerTasksPanel({ tasks }: CustomerTasksPanelProps) {
  const [updateTask, { isLoading: isTaskUpdating }] = useUpdateTaskMutation();

  const handleStatusChange = async (task: TaskItem, status: TaskStatus) => {
    try {
      await updateTask({ id: task._id, status }).unwrap();
      toast.success("Task status updated");
    } catch (error: any) {
      toast.error(error?.data?.error || "Failed to update task status");
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-start text-gray-900 dark:text-white">Tasks</h2>
      {tasks.length > 0 ? (
        <CardSwiper
          items={tasks}
          getKey={(task) => task._id}
          renderItem={(task) => (
            <TaskCard task={task} isUpdating={isTaskUpdating} onStatusChange={handleStatusChange} />
          )}
        />
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No tasks linked to this contact&apos;s enquiries.
        </p>
      )}
    </div>
  );
}
