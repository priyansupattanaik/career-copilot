"""Compose feature routers into the versioned API."""
from fastapi import APIRouter

from app.api.routers.activity import router as activity_router
from app.api.routers.ats import router as ats_router
from app.api.routers.auth import router as auth_router
from app.api.routers.bootstrap import router as bootstrap_router
from app.api.routers.directory import router as directory_router
from app.api.routers.files import router as files_router
from app.api.routers.health import router as health_router
from app.api.routers.interviews import router as interviews_router
from app.api.routers.job_descriptions import router as job_descriptions_router
from app.api.routers.jobs import router as jobs_router
from app.api.routers.learning import router as learning_router
from app.api.routers.profile import router as profile_router
from app.api.routers.resumes import router as resumes_router
from app.api.routers.settings import router as settings_router
from app.features.resume_improvement.routes import router as resume_improvement_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(resume_improvement_router)
router.include_router(health_router)
router.include_router(files_router)
router.include_router(bootstrap_router)
router.include_router(activity_router)
router.include_router(directory_router)
router.include_router(profile_router)
router.include_router(resumes_router)
router.include_router(job_descriptions_router)
router.include_router(ats_router)
router.include_router(interviews_router)
router.include_router(learning_router)
router.include_router(jobs_router)
router.include_router(settings_router)
