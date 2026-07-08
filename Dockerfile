FROM ghcr.io/open-webui/open-webui:main
ENV WEBUI_SECRET_KEY=shared-cloud-secret-key-12345
ENV ENABLE_RAG=False
ENV PORT=8080
EXPOSE 8080
