# BookStack AI

> A complete personal library management system with hierarchical classification, intelligent AI suggestions, and advanced analytics. Organize your reading list, track your progress, set annual goals, and export visual showcases of your bookshelf.

![System Demonstration](https://github.com/vitoriapguimaraes/bookstack-ai/blob/main/frontend/public/demo/navigation.gif)

## Key Features

- **Intelligent Book Management**: Full CRUD with automatic metadata suggestions via AI (Groq) and Google Books API.
- **Hierarchical Classification**: Robust organization into 6 classes and 47 categories for better knowledge segmentation.
- **Showcase Exporter (New)**: Generate shareable images of your bookshelf ("aesthetic") with a book counter, filter summary, and layout optimized for social media.
- **Advanced Analytics**: Interactive dashboard with reading metrics, class distribution, and goal progress.
- **User Settings (New)**: Set and track annual reading goals with persistence of preferences and filters.
- **Priority System (Score)**: Algorithm that automatically calculates reading priority based on multiple factors.
- **Dynamic Reading Queue**: Automatic organization of upcoming books based on status and priority.

## Technologies Used

### Frontend

- [![React](https://img.shields.io/badge/react-000000?style=for-the-badge&logo=react&logoColor=white)](https://reactjs.org/)
- [![Vite](https://img.shields.io/badge/vite-000000?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
- [![Tailwind CSS](https://img.shields.io/badge/tailwindcss-000000?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

### Backend / Data

- [![FastAPI](https://img.shields.io/badge/fastapi-000000?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
- [![SQLite](https://img.shields.io/badge/sqlite-000000?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)

### AI / External APIs

- [![Google Books API](https://img.shields.io/badge/google%20books%20api-000000?style=for-the-badge&logo=google&logoColor=white)](https://developers.google.com/books)
- [![Groq LLM](https://img.shields.io/badge/groq-000000?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com/)

## Getting Started

### Prerequisites

- Node.js
- Python 3.10+

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/vitoriapguimaraes/bookstack-ai.git
   ```

2. Navigate to the project directory:

   ```bash
   cd bookstack-ai
   ```

### Execution

#### Run backend

1. Setup and run the backend:

   ```bash
   cd backend
   python -m venv venv
   # Windows: venv\Scripts\activate | Unix: source venv/bin/activate
   pip install -r requirements.txt
   python main.py
   ```

#### Run frontend

1. Setup and run the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## How to Use

1. **Add Books**: Use the AI search to automatically fill in data just by entering the title.
2. **Export Bookshelf**: On the home screen, use the "Compartilhar Estante" (Share Bookshelf) button to generate a customized image of your current progress.
3. **Set Goals**: Go to "Settings > Preferences" to define how many books you want to read in the year.
4. **Analytics**: Track the distribution chart to ensure you are diversifying your readings among classes (Technology, Business, etc.).

## Directory Structure

```text
/bookstack-ai
├── backend/
│   ├── main.py              # FastAPI application
│   ├── models.py            # Data models
│   └── database.py          # SQLite configuration
├── frontend/
│   ├── src/
│   │   ├── components/      # UI Components (BookCard, ShowcaseExporter, etc)
│   │   ├── views/           # Page Views (Home, Analytics, Settings)
│   │   └── index.css        # Tailwind Global Styles
└── README.md
```

## Status

🚧 In development

> See the [open issues](https://github.com/vitoriapguimaraes/bookstack-ai/issues) for suggested improvements and next steps.

## Contributing

Contributions are always welcome! Feel free to open an issue or submit a pull request.

## License

MIT License. See [LICENSE](LICENSE) for more information.

## About Me

Learn more about my qualifications and certifications in my [Documents Folder](https://github.com/vitoriapguimaraes/vitoriapguimaraes/tree/main/doc) on my main profile.
