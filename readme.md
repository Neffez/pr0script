# pr0game sync script

This script was developed for the pr0game.com browser game. It allows to extract specific game information, such as statistics and spy reports, from the game and upload it to a remote database.

The databse used by this script is a PockbetBase instance, though it should be possible to adapt it to any other backend by changing the login and upload calls.

**NOTE**: the script was developed with PocketBase version `0.22.*` and the provided `pb_schema.json` and `pb_hooks` examples may not work on versions >= `0.23.0`!

# Features

Currently, the scripts supports the following actions:

- Upload statistic pages
- Upload spy reports
- Upload player card information (currently broken)
- Upload galaxy view

For each action, a green icon is inserted into the page where appropriate. When the icon is clicked, the information is parsed from the current page and uploaded as JSON data to the remote server.

# Script Installation

For use, simply add this script to Tampermonkey or the likes and edit the database URL, if your databse is not running on localhost. The script is currently only active for universe 5, but you may choose to edit the @include directives to activate it for any other universe.

When not running the backend on localhost, you also need to change the @require directive to point to your public `pocketbase.umd.js` copy, when using Pocketbase.

# Backend Setup

The PocketBase backend is very easy to self host (it's just a single executable), but the free plan of most hosting providers (e.g. pockethost.io) should also be fine.

### Adding collections

After creating your PocketBase instance, you will need to create the neccessary collections to store the uploaded data. To do so, open the admin panel (either via your hosting provider or by opening http://localhost:8090/_ in your browser) and navigate to "Settings -> Import Collections". Choose the `./pocketbase/pb_schema.json` and confirm.

Afterwards, you should have the following collections present

- `alliances`, where all knwon alliances will be stored
- `galaxy_state`, where all known planets and moons will be stored
- `players`, where all known players will be stored
- `spy_reports`, where all uploaded spy reports will be stored
- `uni_rankings`, where all uploaded statistics will be stored
- `permissions`, where you can manage what each user is supposed to upload

### Installing data hooks

To enable actual data to be uploaded to your PocketBase instance, you will need to add `hooks` for the following routes:

- /galaxy (for the galaxy state)
- /spio (for spy reports)
- /stats (for statistics updates)
- /player (for player card update)

The simplest way to create a `hook` is to place a `*.pb.js` file into the `pb_hooks` directory of your pocketbase instance. In the hook, you will have to parse the uploaded JSON data and inset it into the corresponding collection.

The `hooks` used by SiW can be found in the `./pocketbase/pb_hooks`  directory and should work out of the box, if you just copy them into your `pb_hooks` directory. 

When using a hosting provider, you should be able to upload those files via FTP or similar means.

### Serving PocketBase JS-SDK

Additionally, you will need to place the PocketBase JS-SDK into your `pb_public` folder, so the TamperMonkey script can download it. You can either download the newest version from the official PocketBase web site (pocketbase.io) or use the one available under `./pocketbase/pb_public`.

When using a hosting provider, you should be able to upload those files via FTP or similar means.

### Adding a user

To add a user, first navigate to the `users` collection and click on "New Record". Fill in the details and make sure to check both the "Verified" and "app_user" checkboxes. Afterwards, go the the `permissions` collection and add a "New Record" here.

To the `user` relation, select the newly created user and enable the checkboxes for the `hooks` the user should be able to upload data to.

### Preparing for use

The database relies on a few pr0game internal IDs for reliable identification (e.g. player and planet IDs). Therefore, you may experience error messages when trying to upload spy reports. To avoid those, please

- upload all statistic pages once (so you will have all player- and alliance IDs in the database)
- upload the galaxy view of the galaxy the planet you spied on resides in

# Login

For use with the PocketBase backend, the script will add a login form on the ingame settings page. If you choose another backend, you may want to change the handling of this form or remove it entirely.

When using PocketBase, you will need to create a user in the `users` collection and add the user to the `permissions` collection to enable uploads by this user.

# Data retrieval

The data stored in the PocketBase instance can be inspected either using the Admin-Dashboard (i.e. by navigating to http://localhost:8090/_ in your browser) or using the PocketBase SDK in the language of your choice. There are many wrappers available (e.g. for Python or Javascript) that offer an easy way to access and analyze the data.

You can also create custom Views in your Admin-Panel, which allows you to run SQL query that combine all data in a way that suits you.