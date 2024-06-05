# Telegram Virtual Spiritual Teacher

Production bot name: 
@RogaTheSpiritualBot

To run in dev mode:
npm run dev

Dev bot name: 
@testrogabot

-----------------------Enviroment setup------------------------------

1. Make sure you have Node.js .

2. clone the repository git clone https://github.com/TheZohan/roga-telegram-bot.gitroga-telegram-bot.git 

3. Make sure the wd in your terminal is roga-telegram-bot (use the cd command to change the wd). 

4. Install dependencies: npm install 

5. Create new file called ".env" in the main directory.

6. paste the keys into the .env .

7. you are all set run "npm run dev" to use dev mode.

* only for windows user you need to install cross-env package.
  use this npm command "npm install cross-env --save-dev"
  than go to package.json file and change the dev line in script to 
  "cross-env nodemon --watch \"src/**/*.ts\" --exec 'ts-node' src/index.ts",

-------------------------------------------------------------------------