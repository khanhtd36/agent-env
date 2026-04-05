FROM debian:bookworm-slim

ARG USERNAME=agent
ARG USER_UID=1000
ARG USER_GID=1000
ARG NODE_MAJOR=22
ARG GO_VERSION=1.24.2
ARG BUN_VERSION=1.2.8
ARG TARGETARCH
ARG JUST_VERSION=1.49.0

ENV DEBIAN_FRONTEND=noninteractive \
    PATH=/usr/local/go/bin:/home/agent/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash ca-certificates curl wget git unzip zip jq procps less file \
    build-essential make sudo rsync gnupg lsb-release apt-transport-https \
    ripgrep fd-find fzf python3 python3-venv python3-pip xz-utils tmux \
    chromium fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libc6 libcairo2 libcups2 libdbus-1-3 libdrm2 libexpat1 libgbm1 \
    libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
    libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 libxext6 \
    libxfixes3 libxrandr2 xvfb && \
    rm -rf /var/lib/apt/lists/*

RUN ARCH="${TARGETARCH:-amd64}" && \
    case "$ARCH" in \
      amd64) NODE_ARCH=x64; GO_ARCH=amd64; BUN_ARCH=x64; JUST_ARCH=x86_64-unknown-linux-musl; LG_ARCH=Linux_x86_64; LD_ARCH=Linux_x86_64 ;; \
      arm64) NODE_ARCH=arm64; GO_ARCH=arm64; BUN_ARCH=aarch64; JUST_ARCH=aarch64-unknown-linux-musl; LG_ARCH=Linux_arm64; LD_ARCH=Linux_arm64 ;; \
      *) echo "Unsupported arch: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - && \
    apt-get update && apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm @anthropic-ai/claude-code@latest @openai/codex@latest @mariozechner/pi-coding-agent@latest agent-browser@latest && \
    curl -fsSL https://go.dev/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz -o /tmp/go.tgz && \
    rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tgz && rm /tmp/go.tgz && \
    ln -sf /usr/local/go/bin/go /usr/local/bin/go && ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt && \
    curl -fsSL https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-${BUN_ARCH}.zip -o /tmp/bun.zip && \
    unzip /tmp/bun.zip -d /tmp && mv /tmp/bun-linux-${BUN_ARCH}/bun /usr/local/bin/bun && \
    chmod +x /usr/local/bin/bun && rm -rf /tmp/bun.zip /tmp/bun-linux-${BUN_ARCH} && \
    curl -fsSL https://github.com/casey/just/releases/download/${JUST_VERSION}/just-${JUST_VERSION}-${JUST_ARCH}.tar.gz -o /tmp/just.tar.gz && \
    tar -xzf /tmp/just.tar.gz -C /tmp && mv /tmp/just /usr/local/bin/just && chmod +x /usr/local/bin/just && rm -f /tmp/just.tar.gz && \
    LAZYGIT_VERSION=$(curl -fsSL https://api.github.com/repos/jesseduffield/lazygit/releases/latest | jq -r '.tag_name' | sed 's/^v//') && \
    curl -fsSL "https://github.com/jesseduffield/lazygit/releases/download/v${LAZYGIT_VERSION}/lazygit_${LAZYGIT_VERSION}_${LG_ARCH}.tar.gz" -o /tmp/lazygit.tar.gz && \
    tar -xzf /tmp/lazygit.tar.gz -C /tmp lazygit && mv /tmp/lazygit /usr/local/bin/lazygit && chmod +x /usr/local/bin/lazygit && rm -f /tmp/lazygit.tar.gz && \
    LAZYDOCKER_VERSION=$(curl -fsSL https://api.github.com/repos/jesseduffield/lazydocker/releases/latest | jq -r '.tag_name' | sed 's/^v//') && \
    curl -fsSL "https://github.com/jesseduffield/lazydocker/releases/download/v${LAZYDOCKER_VERSION}/lazydocker_${LAZYDOCKER_VERSION}_${LD_ARCH}.tar.gz" -o /tmp/lazydocker.tar.gz && \
    tar -xzf /tmp/lazydocker.tar.gz -C /tmp lazydocker && mv /tmp/lazydocker /usr/local/bin/lazydocker && chmod +x /usr/local/bin/lazydocker && rm -f /tmp/lazydocker.tar.gz

RUN install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    . /etc/os-release && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin docker-buildx-plugin && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd --gid ${USER_GID} ${USERNAME} && \
    useradd --uid ${USER_UID} --gid ${USER_GID} -m -s /bin/bash ${USERNAME} && \
    usermod -aG sudo ${USERNAME} && \
    echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${USERNAME} && \
    chmod 0440 /etc/sudoers.d/${USERNAME}

RUN mkdir -p /workspace /run/host-secrets/claude /run/host-secrets/pi /run/host-secrets/codex /opt/agent/prompts && \
    chown -R ${USERNAME}:${USERNAME} /workspace /run/host-secrets /home/${USERNAME}

COPY entrypoint.sh /usr/local/bin/agent-entrypoint.sh
COPY shell/bashrc.append /opt/agent/bashrc.append
COPY shell/banner.sh /opt/agent/banner.sh
COPY prompts/pi-agent-context.md /opt/agent/prompts/pi-agent-context.md
RUN chmod +x /usr/local/bin/agent-entrypoint.sh /opt/agent/banner.sh && chmod 0644 /opt/agent/bashrc.append /opt/agent/prompts/pi-agent-context.md

USER ${USERNAME}
WORKDIR /workspace
ENV PLAYWRIGHT_BROWSERS_PATH=/home/${USERNAME}/.cache/ms-playwright \
    AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium \
    BASH_ENV=/home/${USERNAME}/.bash_env

ENTRYPOINT ["/usr/local/bin/agent-entrypoint.sh"]
CMD ["bash"]
