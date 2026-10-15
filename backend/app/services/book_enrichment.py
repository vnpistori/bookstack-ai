from .metadata import get_google_books_data, get_hybrid_rating, get_openlibrary_data
from .ai import get_ai_classification


def _apply_google_data(result: dict, google_data: dict) -> str:
    """Merges Google Books fields into result. Returns the book description."""
    if not google_data:
        return ""
    result["author"] = google_data.get("author") or result.get("author")
    result["year"] = google_data.get("year") or result.get("year")
    result["cover_image"] = google_data.get("cover_image") or result.get("cover_image")
    return google_data.get("description", "")


def _apply_ai_data(result: dict, ai_data: dict) -> None:
    """Merges AI classification fields into result."""
    result["book_class"] = ai_data.get("book_class", "Desenvolvimento Pessoal")
    result["type"] = ai_data.get("type", "Não Técnico")
    result["category"] = ai_data.get("category", "Geral")
    result["motivation"] = ai_data.get("motivation")
    result["original_title"] = ai_data.get("original_title") or result.get("original_title")


def _fill_cover_fallback(result: dict, title: str, google_data: dict, author: str = None) -> None:
    """Tries to fill missing cover and original_title using subtitle, original-title, or Open Library."""
    # Fallback original_title: use Google Books subtitle when AI didn't detect one
    if not result.get("original_title") and google_data:
        subtitle = google_data.get("subtitle", "")
        if subtitle and subtitle.lower() != title.lower():
            result["original_title"] = subtitle

    # Fallback cover: retry Google Books with original title + author
    if not result.get("cover_image") and result.get("original_title"):
        orig_data = get_google_books_data(result["original_title"], author or result.get("author"))
        if orig_data and orig_data.get("cover_image"):
            result["cover_image"] = orig_data["cover_image"]
            result.setdefault("author", orig_data.get("author"))
            result.setdefault("year", orig_data.get("year"))

    # Fallback cover via Open Library
    if not result.get("cover_image"):
        ol_data = get_openlibrary_data(result.get("original_title") or title, author or result.get("author"))
        if ol_data:
            if ol_data.get("cover_image"):
                result["cover_image"] = ol_data["cover_image"]
            if not result.get("year") and ol_data.get("year"):
                result["year"] = ol_data["year"]
            if not result.get("author") and ol_data.get("author"):
                result["author"] = ol_data["author"]


def get_book_details_hybrid(
    title: str,
    api_keys: dict = None,
    custom_prompts: dict = None,
    class_categories: dict = None,
    author: str = None,
) -> dict:
    """Solução híbrida: Google Books API + Open Library + Provedor de IA configurado."""
    result = {
        "author": author,
        "year": None,
        "book_class": "Desenvolvimento Pessoal",
        "type": "Não Técnico",
        "category": "Geral",
        "motivation": None,
        "cover_image": None,
        "google_rating": None,
        "google_ratings_count": None,
    }

    # 1. Fact Data (Google Books)
    google_data = get_google_books_data(title, author)
    description = _apply_google_data(result, google_data) if google_data else ""

    # Open Library fallback for facts if Google Books missing
    if not google_data or not result.get("author") or not result.get("year"):
        ol_data = get_openlibrary_data(title, author)
        if ol_data:
            if not result.get("author") and ol_data.get("author"):
                result["author"] = ol_data["author"]
            if not result.get("year") and ol_data.get("year"):
                result["year"] = ol_data["year"]
            if not result.get("cover_image") and ol_data.get("cover_image"):
                result["cover_image"] = ol_data["cover_image"]
            if not result.get("original_title") and ol_data.get("original_title"):
                result["original_title"] = ol_data["original_title"]

    # 2. Rating
    rating_data = get_hybrid_rating(title, result.get("author"), result.get("original_title"))
    if rating_data:
        result["google_rating"] = rating_data["average_rating"]
        result["google_ratings_count"] = rating_data.get("ratings_count", 0)

    # 3. AI Enrichment
    ai_data = get_ai_classification(
        title, description, api_keys, custom_prompts, class_categories
    )
    if ai_data and "error" in ai_data:
        return {"error": ai_data["error"], "partial_result": result}
    if ai_data:
        _apply_ai_data(result, ai_data)

    # 4 & 5. Original title + cover fallbacks
    _fill_cover_fallback(result, title, google_data, author)

    return result
