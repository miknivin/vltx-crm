-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'employee', 'team_member', 'admin');

-- CreateEnum
CREATE TYPE "SignupMethod" AS ENUM ('OTP', 'EmailPassword', 'OAuth');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('PLATINUM_METAL', 'PLATINUM_JEWELLERY', 'LOOSE_DIAMOND', 'DIAMOND_JEWELLERY', 'PRECIOUS_GEMSTONE', 'GEMSTONE_JEWELLERY', 'LUXURY_WATCH', 'OTHER_LUXURY_ASSET');

-- CreateEnum
CREATE TYPE "JewelleryType" AS ENUM ('NECKLACE', 'EARRING', 'BANGLE', 'RINGS', 'PENDANT', 'OTHERS');

-- CreateEnum
CREATE TYPE "ShapeCut" AS ENUM ('ROUND_BRILLIANT', 'ROUND', 'PRINCESS', 'CUSHION', 'OVAL', 'EMERALD', 'PEAR', 'MARQUISE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('AS_NEW', 'EXCELLENT', 'GOOD', 'FAIR');

-- CreateEnum
CREATE TYPE "CertificateLab" AS ENUM ('GIA', 'IGI', 'HRD', 'OTHERS');

-- CreateEnum
CREATE TYPE "PreferredContact" AS ENUM ('CALL', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "EnquiryActivityAction" AS ENUM ('ENQUIRY_CREATED', 'ENQUIRY_UPDATED', 'TAG_ADDED', 'TAG_REMOVED', 'NOTE_ADDED', 'NOTE_UPDATED', 'REMARK_ADDED', 'PIPELINE_ADDED', 'PIPELINE_REMOVED', 'PIPELINE_STAGE_UPDATED', 'ASSIGNED_TO_UPDATED', 'PHOTO_ADDED', 'VALUATION_RECORDED', 'OFFER_MADE');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('contact_linked', 'custom');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "uid" SERIAL NOT NULL,
    "name" VARCHAR(50),
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "password" TEXT,
    "avatar_public_id" TEXT,
    "avatar_url" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "signup_method" "SignupMethod" NOT NULL DEFAULT 'EmailPassword',
    "reset_password_token" TEXT,
    "reset_password_expire" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "mobile" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "city" VARCHAR(120),
    "preferred_contact" "PreferredContact",
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" UUID NOT NULL,
    "reference" SERIAL NOT NULL,
    "customer_id" UUID NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "jewellery_type" "JewelleryType",
    "brand" VARCHAR(120),
    "metal_weight_g" DECIMAL(10,3),
    "carat_weight" DECIMAL(10,3),
    "shape_cut" "ShapeCut",
    "condition" "AssetCondition",
    "certificate_available" BOOLEAN,
    "certificate_lab" "CertificateLab",
    "purchase_year" INTEGER,
    "description" TEXT,
    "estimated_value" DECIMAL(14,2),
    "offered_amount" DECIMAL(14,2),
    "valued_at" TIMESTAMPTZ(6),
    "valued_by_id" UUID,
    "probability" INTEGER NOT NULL DEFAULT 50,
    "notes" TEXT,
    "source_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_photos" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiry_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_assignments" (
    "enquiry_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiry_assignments_pkey" PRIMARY KEY ("enquiry_id","user_id")
);

-- CreateTable
CREATE TABLE "enquiry_tags" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiry_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_activities" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "user_id" UUID,
    "action" "EnquiryActivityAction" NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiry_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_remarks" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "created_by_id" UUID,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiry_remarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "notes" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stages" (
    "id" UUID NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "order" INTEGER NOT NULL,
    "probability" INTEGER NOT NULL DEFAULT 50,
    "is_success" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_entries" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "pipeline_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pipeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" "TaskType" NOT NULL,
    "enquiry_id" UUID,
    "due_date" TIMESTAMPTZ(6),
    "due_time" VARCHAR(5),
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "owner_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignments" (
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("task_id","user_id")
);

-- CreateTable
CREATE TABLE "ai_report_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "last_message_at" TIMESTAMPTZ(6) NOT NULL,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_report_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_report_session_messages" (
    "id" UUID NOT NULL,
    "session_row_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "query_text" TEXT NOT NULL,
    "query_text_display" TEXT,
    "query_text_internal" TEXT,
    "tool_request" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_report_session_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL DEFAULT 'company',
    "company_name" TEXT,
    "legal_name" TEXT,
    "logo_public_id" TEXT,
    "logo_url" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "tax_id" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_uid_key" ON "users"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "customers_mobile_key" ON "customers"("mobile");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "enquiries_reference_key" ON "enquiries"("reference");

-- CreateIndex
CREATE INDEX "enquiries_customer_id_idx" ON "enquiries"("customer_id");

-- CreateIndex
CREATE INDEX "enquiries_category_idx" ON "enquiries"("category");

-- CreateIndex
CREATE INDEX "enquiries_created_at_idx" ON "enquiries"("created_at");

-- CreateIndex
CREATE INDEX "enquiries_source_id_idx" ON "enquiries"("source_id");

-- CreateIndex
CREATE INDEX "enquiries_estimated_value_idx" ON "enquiries"("estimated_value");

-- CreateIndex
CREATE INDEX "enquiry_photos_enquiry_id_position_idx" ON "enquiry_photos"("enquiry_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "sources_title_key" ON "sources"("title");

-- CreateIndex
CREATE INDEX "enquiry_assignments_user_id_idx" ON "enquiry_assignments"("user_id");

-- CreateIndex
CREATE INDEX "enquiry_tags_name_idx" ON "enquiry_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_tags_enquiry_id_name_key" ON "enquiry_tags"("enquiry_id", "name");

-- CreateIndex
CREATE INDEX "enquiry_activities_enquiry_id_created_at_idx" ON "enquiry_activities"("enquiry_id", "created_at");

-- CreateIndex
CREATE INDEX "enquiry_activities_action_idx" ON "enquiry_activities"("action");

-- CreateIndex
CREATE INDEX "enquiry_remarks_enquiry_id_created_at_idx" ON "enquiry_remarks"("enquiry_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_name_key" ON "pipelines"("name");

-- CreateIndex
CREATE INDEX "pipelines_user_id_idx" ON "pipelines"("user_id");

-- CreateIndex
CREATE INDEX "stages_pipeline_id_idx" ON "stages"("pipeline_id");

-- CreateIndex
CREATE UNIQUE INDEX "stages_pipeline_id_order_key" ON "stages"("pipeline_id", "order");

-- CreateIndex
CREATE INDEX "pipeline_entries_pipeline_id_stage_id_order_idx" ON "pipeline_entries"("pipeline_id", "stage_id", "order");

-- CreateIndex
CREATE INDEX "pipeline_entries_stage_id_idx" ON "pipeline_entries"("stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_entries_enquiry_id_pipeline_id_key" ON "pipeline_entries"("enquiry_id", "pipeline_id");

-- CreateIndex
CREATE INDEX "tasks_enquiry_id_status_idx" ON "tasks"("enquiry_id", "status");

-- CreateIndex
CREATE INDEX "tasks_owner_id_created_at_idx" ON "tasks"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "tasks_due_date_status_idx" ON "tasks"("due_date", "status");

-- CreateIndex
CREATE INDEX "task_assignments_user_id_idx" ON "task_assignments"("user_id");

-- CreateIndex
CREATE INDEX "ai_report_sessions_user_id_last_message_at_idx" ON "ai_report_sessions"("user_id", "last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_report_sessions_user_id_session_id_key" ON "ai_report_sessions"("user_id", "session_id");

-- CreateIndex
CREATE INDEX "ai_report_session_messages_session_row_id_created_at_idx" ON "ai_report_session_messages"("session_row_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_report_session_messages_user_id_created_at_idx" ON "ai_report_session_messages"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_valued_by_id_fkey" FOREIGN KEY ("valued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_photos" ADD CONSTRAINT "enquiry_photos_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_assignments" ADD CONSTRAINT "enquiry_assignments_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_assignments" ADD CONSTRAINT "enquiry_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_tags" ADD CONSTRAINT "enquiry_tags_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_tags" ADD CONSTRAINT "enquiry_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_activities" ADD CONSTRAINT "enquiry_activities_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_activities" ADD CONSTRAINT "enquiry_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_remarks" ADD CONSTRAINT "enquiry_remarks_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_remarks" ADD CONSTRAINT "enquiry_remarks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_entries" ADD CONSTRAINT "pipeline_entries_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_entries" ADD CONSTRAINT "pipeline_entries_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_entries" ADD CONSTRAINT "pipeline_entries_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_report_sessions" ADD CONSTRAINT "ai_report_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_report_session_messages" ADD CONSTRAINT "ai_report_session_messages_session_row_id_fkey" FOREIGN KEY ("session_row_id") REFERENCES "ai_report_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_report_session_messages" ADD CONSTRAINT "ai_report_session_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written additions to the generated schema.
-- ---------------------------------------------------------------------------

-- Staff-facing references start in a range that reads like an id rather than a
-- row count, so "user 3" / "enquiry 7" never appears in the UI.
ALTER SEQUENCE "users_uid_seq" RESTART WITH 100001;
ALTER SEQUENCE "enquiries_reference_seq" RESTART WITH 1001;

-- Trigram indexes back the keyword search in the filter panels: they make
-- `ILIKE '%term%'` index-assisted, which a plain B-tree cannot do for a
-- leading wildcard.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "customers_name_trgm_idx" ON "customers" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "customers_mobile_trgm_idx" ON "customers" USING GIN ("mobile" gin_trgm_ops);
CREATE INDEX "customers_email_trgm_idx" ON "customers" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "enquiries_brand_trgm_idx" ON "enquiries" USING GIN ("brand" gin_trgm_ops);
CREATE INDEX "enquiries_description_trgm_idx" ON "enquiries" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "enquiries_notes_trgm_idx" ON "enquiries" USING GIN ("notes" gin_trgm_ops);
CREATE INDEX "enquiry_tags_name_trgm_idx" ON "enquiry_tags" USING GIN ("name" gin_trgm_ops);
