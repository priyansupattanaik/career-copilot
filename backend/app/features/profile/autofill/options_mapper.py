from __future__ import annotations

from app.features.profile.autofill.verifier import normalize_text

LOCATION_OPTIONS = [
    "Remote",
    "Pune",
    "Bengaluru",
    "Hyderabad",
    "Mumbai",
    "Delhi NCR",
    "Chennai",
    "Kolkata",
    "Ahmedabad",
    "Jaipur",
    "Noida",
    "Gurgaon",
]

TARGET_ROLE_OPTIONS = [
    "Software Engineer",
    "Backend Engineer",
    "Frontend Engineer",
    "Full Stack Engineer",
    "Data Analyst",
    "Data Scientist",
    "Data Engineer",
    "Machine Learning Engineer",
    "DevOps Engineer",
    "Cloud Engineer",
    "QA Engineer",
    "Product Manager",
    "UI/UX Designer",
    "Business Analyst",
    "Cybersecurity Analyst",
]

DEGREE_OPTIONS = [
    "B.Tech",
    "B.E.",
    "B.Sc",
    "BCA",
    "M.Tech",
    "M.Sc",
    "MCA",
    "MBA",
    "PG-DAC",
    "Diploma",
    "PhD",
]

FIELD_OF_STUDY_OPTIONS = [
    "Computer Science",
    "Information Technology",
    "Electronics",
    "Data Science",
    "Artificial Intelligence",
    "Mechanical",
    "Business",
]

SKILL_CATALOG = [
    "Python",
    "Java",
    "JavaScript",
    "TypeScript",
    "SQL",
    "React",
    "Node.js",
    "Next.js",
    "Django",
    "FastAPI",
    "Spring Boot",
    "AWS",
    "Azure",
    "Docker",
    "Kubernetes",
    "Git",
    "Power BI",
    "Tableau",
    "Machine Learning",
    "HTML/CSS",
]

EMPLOYMENT_TYPE_MAP = {
    "full_time": "Full-time",
    "part_time": "Part-time",
    "contract": "Contract",
    "internship": "Internship",
    "freelance": "Freelance",
}

LINK_TYPE_MAP = {
    "linkedin": "LinkedIn",
    "github": "GitHub",
    "portfolio": "Portfolio",
    "website": "Website",
    "other": "Other",
}


def pick_best_location(city: str | None, region: str | None, country: str | None) -> str | None:
    """Most specific component available: city, then region, then country."""
    if city and str(city).strip():
        return str(city).strip()
    if region and str(region).strip():
        return str(region).strip()
    if country and str(country).strip():
        return str(country).strip()
    return None


def match_option_exact(value: str | None, options: list[str]) -> str | None:
    """Exact match of normalized value against normalized option labels."""
    if not value:
        return None
    val_norm = normalize_text(value)
    for opt in options:
        if normalize_text(opt) == val_norm:
            return opt
    return None


def map_value_to_catalog(value: str | None, options: list[str], accepts_free_text: bool = True) -> tuple[str | None, str]:
    """
    Returns (mapped_value, status) where status is:
    - "matched" if found in catalog
    - "custom" if free-text field accepted as-is
    - "unmapped" if cannot be mapped
    """
    if not value or not str(value).strip():
        return None, "unmapped"
    val_str = str(value).strip()
    exact = match_option_exact(val_str, options)
    if exact:
        return exact, "matched"
    if accepts_free_text:
        return val_str, "custom"
    return None, "unmapped"
