import json
import os
from .scoring import CLASS_CATEGORIES


def _parse_json_safe(content: str) -> dict:
    """Extrai e faz parse seguro de JSON, mesmo se vier envolvido em blocos markdown."""
    if not content:
        raise ValueError("Resposta vazia da IA")
    clean = content.strip()
    if clean.startswith("```"):
        lines = clean.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        clean = "\n".join(lines).strip()
    return json.loads(clean)


def get_gemini_classification(prompt, system_prompt, api_keys=None):
    try:
        import google.generativeai as genai

        api_key = (api_keys or {}).get("gemini_key") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            return {"error": "GEMINI_API_KEY não configurada"}

        genai.configure(api_key=api_key)

        # Modelos disponíveis em ordem de preferência
        models_to_try = [
            "gemini-flash-latest",
            "gemini-3.8-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash",
            "gemini-1.5-flash",
        ]

        full_prompt = f"{system_prompt}\n\nUSER PROMPT:\n{prompt}"
        last_error = None

        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(
                    model_name,
                    generation_config={"response_mime_type": "application/json"},
                )
                response = model.generate_content(full_prompt)
                if response and response.text:
                    return _parse_json_safe(response.text)
            except Exception as e:
                err_msg = str(e)
                last_error = err_msg
                print(f"Gemini ({model_name}) falhou: {err_msg}. Tentando próximo modelo...")
                continue

        return {"error": f"Erro Gemini: {last_error or 'Nenhum modelo Gemini respondeu'}"}
    except Exception as e:
        return {"error": f"Erro Gemini: {str(e)}"}


def get_openai_classification(prompt, system_prompt, api_keys=None):
    try:
        from openai import OpenAI

        api_key = (api_keys or {}).get("openai_key") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            return {"error": "OPENAI_API_KEY não configurada"}

        client = OpenAI(api_key=api_key)
        models_to_try = ["gpt-4o-mini", "gpt-4o"]
        last_error = None

        for model_name in models_to_try:
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": system_prompt + " Responda estritamente em JSON.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.7,
                )
                content = response.choices[0].message.content
                if content:
                    return _parse_json_safe(content)
            except Exception as e:
                err_msg = str(e)
                last_error = err_msg
                print(f"OpenAI ({model_name}) falhou: {err_msg}. Tentando próximo modelo...")
                continue

        return {"error": f"Erro OpenAI: {last_error or 'Nenhum modelo OpenAI respondeu'}"}
    except Exception as e:
        return {"error": f"Erro OpenAI: {str(e)}"}


def get_groq_classification(prompt, system_prompt, api_keys=None):
    api_key = (api_keys or {}).get("groq_key") or os.getenv("GROQ_API_KEY")
    if not api_key:
        return {"error": "GROQ_API_KEY não configurada"}

    try:
        from groq import Groq

        client = Groq(api_key=api_key)

        models_to_try = [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "qwen/qwen3.8-27b",
        ]

        last_error = None
        for model_name in models_to_try:
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": system_prompt + " Responda estritamente em JSON.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.7,
                )
                content = response.choices[0].message.content
                if content:
                    return _parse_json_safe(content)
            except Exception as e:
                err_msg = str(e)
                last_error = err_msg
                print(f"Groq ({model_name}) falhou: {err_msg}. Tentando próximo modelo...")
                continue

        return {"error": f"Erro Groq: {last_error or 'Nenhum modelo Groq respondeu'}"}
    except Exception as e:
        return {"error": f"Erro Groq: {str(e)}"}


def get_ai_classification(
    title: str,
    description: str = "",
    api_keys: dict = None,
    custom_prompts: dict = None,
    class_categories: dict = None,
):
    current_mapping = (
        class_categories
        if class_categories and len(class_categories) > 0
        else CLASS_CATEGORIES
    )

    class_categories_str = "\n".join(
        [f"- {cls}: {', '.join(cats)}" for cls, cats in current_mapping.items()]
    )
    valid_classes_str = "\n".join([f"   - {cls}" for cls in current_mapping.keys()])

    system_prompt = (custom_prompts or {}).get(
        "system_prompt"
    ) or "Você é um assistente literário especializado."

    user_prompt_template = (custom_prompts or {}).get("user_prompt")
    if user_prompt_template:
        prompt = (
            f"{user_prompt_template}\n\n"
            f"!!! INSTRUÇÃO DE SISTEMA OBRIGATÓRIA - LISTAS VÁLIDAS ATUAIS !!!\n"
            f"Independente do que o prompt acima diga, você DEVE usar APENAS as seguintes classes e categorias:\n\n"
            f'1. "book_class" (string): Escolha UMA das classes abaixo:\n{valid_classes_str}\n\n'
            f'2. "category" (string): Escolha UMA categoria específica válida para a classe:\n{class_categories_str}\n\n'
            f'LIVRO A ANALISAR:\nTítulo: "{title}"\nDescrição: "{description[:1500]}"'
        )
    else:
        description_section = (
            f'RESUMO DO LIVRO (via Google Books):\n"{description[:1500]}"'
            if description and description.strip()
            else "RESUMO DO LIVRO: Não disponível — use seu conhecimento sobre o livro."
        )
        prompt = f"""
LIVRO A ANALISAR:
Título: "{title}"

{description_section}

INSTRUÇÕES DE CLASSIFICAÇÃO:

PROCESSO DE RACIOCÍNIO OBRIGATÓRIO:
1. Leia o resumo acima com atenção.
2. Defina a "book_class" (Classe Macro) adequada.
3. Consulte a lista de categorias APENAS dessa classe específica.
4. Escolha a "category" (Subcategoria) a partir dessa lista restrita.

1. "book_class" (string): Escolha UMA das classes abaixo.
{valid_classes_str}

2. "category" (string): Escolha UMA categoria específica válida para a classe selecionada.
{class_categories_str}

3. "type" (string): "Técnico" ou "Não Técnico"

4. "motivation" (string): Com base no resumo real do livro acima, escreva 2-3 frases diretas e específicas que explicam por que ler ESTE livro — não qualquer livro do mesmo tema. O que este livro ensina de concreto? Que problema ou gap ele resolve? O que o leitor vai sair sabendo que não sabia antes? Foque no diferencial único desta obra. Não use introduções genéricas como "Este livro é importante porque..." ou "Esta obra aborda...". Comece direto no argumento.

5. "original_title" (string): O título original do livro (se for tradução). Se já estiver em inglês ou for o título original, repita o título.

Responda APENAS com um JSON válido:
{{
  "book_class": "...",
  "category": "...",
  "type": "...",
  "motivation": "...",
  "original_title": "..."
}}
"""

    preferred_provider = (api_keys or {}).get("ai_provider", "groq").lower()
    if preferred_provider not in ["openai", "gemini", "groq"]:
        preferred_provider = os.getenv("AI_PROVIDER", "groq").lower()

    providers = []
    # Simplified priority list
    p_map = {
        "gemini": [
            get_gemini_classification,
            get_groq_classification,
            get_openai_classification,
        ],
        "openai": [
            get_openai_classification,
            get_gemini_classification,
            get_groq_classification,
        ],
        "groq": [
            get_groq_classification,
            get_gemini_classification,
            get_openai_classification,
        ],
    }
    providers = p_map.get(preferred_provider, p_map["groq"])

    errors = []
    print(f"Tentando classificar com {preferred_provider.upper()}...")

    for provider_func in providers:
        res = provider_func(prompt, system_prompt, api_keys)
        if isinstance(res, dict) and "error" in res:
            errors.append(f"{provider_func.__name__}: {res['error']}")
            continue
        if not res:
            errors.append(f"{provider_func.__name__}: Retorno vazio")
            continue

        print(f"Sucesso com {provider_func.__name__}")
        return res

    return {"error": f"Falha em todas as IAs. {' | '.join(errors)}"}
