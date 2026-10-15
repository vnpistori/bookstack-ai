import os
import json
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, START, END
from app.services.metadata import get_google_books_data, get_hybrid_rating, get_openlibrary_data
from app.services.scoring import CLASS_CATEGORIES
from app.services.ai import get_ai_classification


class BookGraphState(TypedDict):
    title: str
    author: Optional[str]
    year: Optional[int]
    abstract: Optional[str]
    book_class: Optional[str]
    type: Optional[str]
    category: Optional[str]
    motivation: Optional[str]
    original_title: Optional[str]
    google_rating: Optional[float]
    google_ratings_count: Optional[int]
    cover_image: Optional[str]
    error: Optional[str]
    api_keys: dict
    custom_prompts: dict
    class_categories: dict


def fetch_book_data(state: BookGraphState) -> dict:
    title = state.get("title", "").strip()
    author = state.get("author")
    if author:
        author = author.strip()

    if not title:
        return {"error": "Título do livro não informado."}

    google_data = get_google_books_data(title, author) or {}
    openlib_data = get_openlibrary_data(title, author) or {}

    # Merge metadata: prioritize Google Books, fallback to Open Library
    resolved_author = google_data.get("author") or openlib_data.get("author") or author
    resolved_year = google_data.get("year") or openlib_data.get("year")
    resolved_abstract = google_data.get("description", "")
    resolved_cover = google_data.get("cover_image") or openlib_data.get("cover_image")
    resolved_original_title = (
        openlib_data.get("original_title")
        or google_data.get("subtitle")
        or google_data.get("original_title")
        or title
    )

    return {
        "author": resolved_author,
        "year": resolved_year,
        "abstract": resolved_abstract,
        "cover_image": resolved_cover,
        "original_title": resolved_original_title,
    }


def fetch_ratings(state: BookGraphState) -> dict:
    rating_data = get_hybrid_rating(
        state["title"],
        state.get("author"),
        state.get("original_title"),
    )
    if rating_data:
        return {
            "google_rating": rating_data.get("average_rating"),
            "google_ratings_count": rating_data.get("ratings_count", 0),
        }
    return {}


def impute_classification(state: BookGraphState) -> dict:
    if state.get("error"):
        return {}

    title = state["title"]
    description = state.get("abstract") or ""
    api_keys = state.get("api_keys") or {}
    custom_prompts = state.get("custom_prompts")
    class_categories = state.get("class_categories")

    ai_data = get_ai_classification(
        title=title,
        description=description,
        api_keys=api_keys,
        custom_prompts=custom_prompts,
        class_categories=class_categories,
    )

    if isinstance(ai_data, dict) and "error" in ai_data:
        return {"error": ai_data["error"]}

    if not isinstance(ai_data, dict):
        return {"error": "Retorno inválido da IA"}

    updates = {
        "book_class": ai_data.get("book_class"),
        "category": ai_data.get("category"),
        "type": ai_data.get("type"),
    }
    if ai_data.get("motivation"):
        updates["motivation"] = ai_data["motivation"]
    if ai_data.get("original_title") and not state.get("original_title"):
        updates["original_title"] = ai_data["original_title"]

    return updates


def write_motivation(state: BookGraphState) -> dict:
    if state.get("error"):
        return {}

    # If already set by impute_classification, reuse it
    if state.get("motivation"):
        return {"motivation": state["motivation"]}

    # Fallback to generating motivation if not yet present
    ai_data = get_ai_classification(
        title=state["title"],
        description=state.get("abstract") or "",
        api_keys=state.get("api_keys") or {},
        custom_prompts=state.get("custom_prompts"),
        class_categories=state.get("class_categories"),
    )

    if isinstance(ai_data, dict) and ai_data.get("motivation"):
        return {"motivation": ai_data["motivation"]}

    return {}


def should_continue(state: BookGraphState):
    if state.get("error"):
        return END
    return "fetch_ratings"


def build_graph():
    builder = StateGraph(BookGraphState)
    builder.add_node("fetch_book_data", fetch_book_data)
    builder.add_node("fetch_ratings", fetch_ratings)
    builder.add_node("impute_classification", impute_classification)
    builder.add_node("write_motivation", write_motivation)

    builder.add_edge(START, "fetch_book_data")
    builder.add_conditional_edges("fetch_book_data", should_continue)
    builder.add_edge("fetch_ratings", "impute_classification")
    builder.add_edge("impute_classification", "write_motivation")
    builder.add_edge("write_motivation", END)

    return builder.compile()


def get_book_details_langgraph(
    title: str,
    author: str = None,
    api_keys: dict = None,
    custom_prompts: dict = None,
    class_categories: dict = None,
) -> dict:
    graph = build_graph()
    initial_state = {
        "title": title,
        "author": author,
        "api_keys": api_keys or {},
        "custom_prompts": custom_prompts or {},
        "class_categories": class_categories or {},
    }

    result = graph.invoke(initial_state)

    ret = {
        "author": result.get("author"),
        "year": result.get("year"),
        "book_class": result.get("book_class", "Desenvolvimento Pessoal"),
        "type": result.get("type", "Não Técnico"),
        "category": result.get("category", "Geral"),
        "motivation": result.get("motivation"),
        "cover_image": result.get("cover_image"),
        "original_title": result.get("original_title"),
        "google_rating": result.get("google_rating"),
        "google_ratings_count": result.get("google_ratings_count"),
    }

    if result.get("error"):
        # If we have at least partial metadata (author, cover, etc.), return it as partial_result
        if ret.get("author") or ret.get("cover_image") or ret.get("year") or result.get("abstract"):
            return {"error": result["error"], "partial_result": ret}
        return {"error": result["error"]}

    return ret
