FROM ghcr.io/open-webui/open-webui:main
ENV PORT=8080
ENV WEBUI_SECRET_KEY=shared-cloud-secret-key-12345
ENV ENABLE_RAG=False
EXPOSE 8080
