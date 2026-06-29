-- Migration: 001_create_dashboard_visual_configs
-- Description: Create table for dashboard visual config persistence with versioning.
-- This table stores named JSON configs with draft/active states.
-- Auto-creation on backend startup is handled by SQLAlchemy Base.metadata.create_all
-- via models/dashboard_config.py.
-- This SQL is provided for explicit manual migration and rollback.

-- ============================================================
-- BACKUP REQUIRED BEFORE RUNNING IN PRODUCTION
-- ============================================================
-- mkdir -p ~/backups-dashboard
-- docker exec dashboard_postgres pg_dump -U ruta_user -d ruta_dashboard \
--   > ~/backups-dashboard/ruta_dashboard_$(date +%Y%m%d_%H%M%S).sql
-- Verify backup file exists and is non-empty before proceeding.
-- ============================================================

-- ============================================================
-- Up Migration
-- ============================================================
CREATE TABLE IF NOT EXISTS dashboard_visual_configs (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL DEFAULT '',
    config_json     JSONB NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    is_draft        BOOLEAN NOT NULL DEFAULT TRUE,
    version         INTEGER NOT NULL,
    created_by      VARCHAR(80) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dvc_is_active ON dashboard_visual_configs (is_active);
CREATE INDEX IF NOT EXISTS idx_dvc_version ON dashboard_visual_configs (version);

-- ============================================================
-- Rollback
-- ============================================================
-- DROP TABLE IF EXISTS dashboard_visual_configs;
--
-- Note: Rollback drops all saved configs and history.
-- After rollback, dashboard falls back to localStorage/default behavior.
-- No operational data is affected.
