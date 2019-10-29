FROM node:12-slim

# Add all necessary files to the container
ADD package.json /package.json
ADD yarn.lock /yarn.lock
ADD tsconfig.json /tsconfig.json
ADD src/main.ts /src/main.ts
ADD src/slack-message.ts /src/slack-message.ts
ADD src/types.ts /src/types.ts
ADD src/utils.ts /src/utils.ts

# Install dependencies
RUN yarn

# Compile TypeScript
RUN yarn build

# Run the action
ENTRYPOINT ["node", "/lib/main.js"]