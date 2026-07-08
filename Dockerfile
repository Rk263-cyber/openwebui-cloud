FROM ghcr.io/open-webui/open-webui:main
ENV WEBUI_SECRET_KEY=shared-cloud-secret-key-12345
ENV ENABLE_RAG=False
EXPOSE 8080
RUN echo '#!/bin/bash\nexport PORT=8080\nbash start.sh' > run.sh && chmod +x run.sh
CMD ["./run.sh"]
