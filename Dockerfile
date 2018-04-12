FROM node:6

WORKDIR /usr/src/app

# Install app dependencies4
COPY package.json ./
# For npm@5 or later, copy package-lock.json as well
# COPY package.json package-lock.json ./

RUN npm install

# Bundle app source
COPY . .

EXPOSE 3000
CMD [ "npm", "start" ]
