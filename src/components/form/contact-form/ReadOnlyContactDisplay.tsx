/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useState } from 'react';
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

/// One read-only labelled value box, matching the styling every field on
/// this page already used — pulled out once here instead of repeating the
/// same five class names for every one of the enquiry's ~20 fields.
function Field({
  label,
  value,
  id,
}: {
  label: string;
  value: React.ReactNode;
  id?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-white"
      >
        {label}
      </label>
      <div
        id={id}
        className="dark:bg-dark-900 min-h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
      >
        {value ?? 'N/A'}
      </div>
    </div>
  );
}

const formatCurrency = (value: number | null) =>
  value === null ? null : `₹${value.toLocaleString('en-IN')}`;

const ReadOnlyContactDisplay: React.FC<ReadOnlyContactDisplayProps> = ({ contact }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updateTask, { isLoading: isTaskUpdating }] = useUpdateTaskMutation();

  const { data: tasksData, isLoading: isTasksLoading, error: tasksError } = useGetTasksQuery({ contactId: contact._id });

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

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
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
          Contact Details
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="name" label="Name" value={contact.name} />
          <Field id="phone" label="Phone" value={contact.phone} />
          <Field id="email" label="Email" value={contact.email} />
          <Field id="city" label="City" value={contact.city} />
          <Field
            id="preferredContact"
            label="Preferred Contact"
            value={contact.preferredContactLabel}
          />
          <Field id="source" label="Source" value={contact.source} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
          Asset Details
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field id="category" label="Asset Category" value={contact.categoryLabel} />
          <Field
            id="jewelleryType"
            label="Jewellery Type"
            value={contact.jewelleryTypeLabel}
          />
          <Field id="brand" label="Brand / Maker" value={contact.brand} />
          <Field id="condition" label="Condition" value={contact.conditionLabel} />
          <Field id="shapeCut" label="Shape / Cut" value={contact.shapeCutLabel} />
          <Field
            id="metalWeight"
            label="Metal Weight (g)"
            value={contact.metalWeightG}
          />
          <Field id="carat" label="Weight / Carat" value={contact.caratWeight} />
          <Field
            id="certificateAvailable"
            label="Certificate Available"
            value={
              contact.certificateAvailable === null
                ? null
                : contact.certificateAvailable
                  ? 'Yes'
                  : 'No'
            }
          />
          <Field
            id="certificateLab"
            label="Certifying Lab"
            value={contact.certificateLabLabel}
          />
          <Field id="purchaseYear" label="Purchase Year" value={contact.purchaseYear} />
        </div>
        <div className="mt-4">
          <Field id="description" label="Description" value={contact.description} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
          Valuation
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="estimatedValue"
            label="Estimated Value"
            value={formatCurrency(contact.estimatedValue) ?? 'Not yet valued'}
          />
          <Field
            id="offeredAmount"
            label="Offered Amount"
            value={formatCurrency(contact.offeredAmount) ?? 'No offer made'}
          />
        </div>
      </div>

      <Field id="notes" label="Internal Notes" value={contact.notes} />

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
