FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install Python and pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv

# Install yt-dlp
RUN pip3 install yt-dlp

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh && \
    export PATH="$HOME/.deno/bin:$PATH"

# Set PATH for Deno
ENV PATH="$HOME/.deno/bin:$PATH"

# Verify installations
RUN node --version && \
    python3 --version && \
    deno --version && \
    yt-dlp --version

WORKDIR /workspace
