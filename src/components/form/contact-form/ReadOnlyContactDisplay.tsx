/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useState, useEffect } from 'react';
import {
  ResponseContact,
  TaskItem,
  TaskStatus,
  useGetTasksQuery,
  useUpdateTaskMutation,
} from '@/app/redux/api/contactApi';
import VeryShortSpinnerPrimary from '@/components/ui/loaders/veryShortSpinnerPrimary';
import CardSwiper from '@/components/ui/swiper/CardSwiper';

import { Modal } from '@/components/ui/modal';
import TaskTabs from '@/components/pipeline/TaskTabs';
import TaskCard from '@/components/pipeline/TaskCard';
import Button from '@/components/ui/button/Button';
import { toast } from 'react-toastify';
import EnquiryPhotoGallery from '@/components/contact/EnquiryPhotoGallery';

interface ReadOnlyContactDisplayProps {
  contact: ResponseContact;
}

interface ContactData {
  name: string;
  email: string;
  phone: string;
  notes?: string;
  city?: string;
  source?: string;
  category?: string;
  brand?: string;
  estimatedValue?: string;
}

const ReadOnlyContactDisplay: React.FC<ReadOnlyContactDisplayProps> = ({ contact }) => {
  const [contactData, setContactData] = useState<ContactData>({
    name: '',
    email: '',
    phone: '',
    notes: '',
    city: '',
    source: '',
    category: '',
    brand: '',
    estimatedValue: '',
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updateTask, { isLoading: isTaskUpdating }] = useUpdateTaskMutation();

  const { data: tasksData, isLoading: isTasksLoading, error: tasksError } = useGetTasksQuery({ contactId: contact._id });

  // Pre-populate contact data
  useEffect(() => {
    if (contact) {
      setContactData({
        name: contact.name,
        email: contact.email || '',
        phone: contact.phone,
        notes: contact.notes || '',
        city: contact.city || '',
        source: contact.source || '',
        category: contact.categoryLabel || '',
        brand: contact.brand || '',
        estimatedValue: contact.estimatedValue !== null && contact.estimatedValue !== undefined ? String(contact.estimatedValue) : '',
      });
    }
  }, [contact]);

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleTaskStatusChange = async (task: TaskItem, status: TaskStatus) => {
    try {
      await updateTask({ id: task._id, status }).unwrap();
      toast.success('Task status updated');
    } catch (error: any) {
      toast.error(error?.data?.error || 'Failed to update task status');
    }
  };

  return (
    <>
    <div className="space-y-6 sticky top-1 md:top-20">
      <div>
        <label
          htmlFor="name"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white"
        >
          Name
        </label>
        <div
          id="name"
          className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          {contactData.name}
        </div>
      </div>
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white"
        >
          Email
        </label>
        <div
          id="email"
          className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          {contactData.email}
        </div>
      </div>
      <div>
        <label
          htmlFor="phone"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white"
        >
          Phone
        </label>
        <div
          id="phone"
          className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          {contactData.phone}
        </div>
      </div>
      <div>
        <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white">
          City
        </label>
        <div id="city" className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
          {contactData.city || 'N/A'}
        </div>
      </div>
      <div>
        <label
          htmlFor="source"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white"
        >
          Source
        </label>
        <div
          id="source"
          className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          {contactData.source || 'N/A'}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white">
            Asset Category
          </label>
          <div id="category" className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
            {contactData.category || 'N/A'}
          </div>
        </div>
        <div>
          <label htmlFor="brand" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white">
            Brand / Maker
          </label>
          <div id="brand" className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
            {contactData.brand || 'N/A'}
          </div>
        </div>
        <div>
          <label htmlFor="estimatedValue" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white">
            Estimated Value (₹)
          </label>
          <div id="estimatedValue" className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90">
            {contactData.estimatedValue || 'Not yet valued'}
          </div>
        </div>
      </div>
      <div>
        <label
          htmlFor="notes"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white"
        >
          Notes
        </label>
        <div
          id="notes"
          className="dark:bg-dark-900 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        >
          {contactData.notes || 'N/A'}
        </div>
      </div>
      <div className="mt-6">
        <EnquiryPhotoGallery photos={contact.photos ?? []} />
      </div>
      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-start text-gray-900 dark:text-white">
            Contact Tasks
          </h2>
          <Button
            variant="primary"
            onClick={openModal}
          >
            Add Task
          </Button>
        </div>
        {isTasksLoading ? (
          <div className="flex justify-center">
            <VeryShortSpinnerPrimary />
          </div>
        ) : tasksError ? (
          <p className="text-red-500 text-sm">
            Failed to load contact tasks: {(tasksError as any)?.data?.message || 'Unknown error'}
          </p>
        ) : tasksData?.tasks && tasksData.tasks.length > 0 ? (
          <CardSwiper
            items={tasksData.tasks}
            getKey={(task) => task._id}
            renderItem={(task) => (
              <TaskCard
                task={task}
                isUpdating={isTaskUpdating}
                onStatusChange={handleTaskStatusChange}
              />
            )}
          />
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No tasks linked to this contact.
          </p>
        )}
      </div>

    </div>
    <Modal isOpen={isModalOpen} onClose={closeModal} className="max-w-[700px] p-6 lg:p-10">
        <TaskTabs contact={contact} onClose={closeModal} />
      </Modal>
    </>
  );
};

export default ReadOnlyContactDisplay;
