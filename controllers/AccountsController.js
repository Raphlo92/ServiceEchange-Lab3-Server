const Repository = require('../models/Repository');
const TokenManager = require('../tokenManager');
const utilities = require("../utilities");
const User = require('../models/user');
const Bookmark = require('../models/bookmark');

module.exports = 
class AccountsController extends require('./Controller') {
    constructor(req, res){
        super(req, res);
        this.usersRepository = new Repository('Users');
        this.bookmarksRepository = new Repository('Bookmarks');
    }

    // list of users with masked password
    index(id) {
        if(!isNaN(id)) {
            let user =  this.usersRepository.get(id);
            if (user != null) {
                let userClone = {...user};
                userClone.Password = "********";
                this.response.JSON(userClone);
            }
        }
        else {
            let users = this.usersRepository.getAll();
            let usersClone = users.map(user => ({...user}));
            for(let user of usersClone) {
                user.Password = "********";
            }
            this.response.JSON(usersClone);
        }
    }

    // POST: /token body payload[{"Email": "...", "Password": "...", "grant-type":"password"}]
    login(loginInfo) {
        // to do assure that grant-type is present in the request header
        let user =  this.usersRepository.findByField("Email", loginInfo.Email);
        if (user != null){
            if (user.Password == loginInfo.Password) {
                let newToken = TokenManager.create(user.Email);
                console.log(newToken)
                this.response.JSON({...newToken, UserId: user.Id, UserName: user.Name});
            } else
                this.response.badRequest();
        } else
            this.response.badRequest();
    }
    
    // POST: account/register body payload[{"Id": 0, "Name": "...", "Email": "...", "Password": "..."}]
    register(user) {  
        user.Created = utilities.nowInSeconds();
        // validate User before insertion
        if (User.valid(user)) {
            // avoid duplicates Email
            if (this.usersRepository.findByField('Email', user.Email) == null) {
                // take a clone of the newly inserted user
                let newUser = {...this.usersRepository.add(user)};
                if (newUser) {
                    // mask password in the json object response
                    newUser.Password = "********";
                    this.response.created(newUser);
                } else
                    this.response.internalError();
            } else
                this.response.conflict();
        } else
            this.response.unprocessable();
    }
    // todo
    change(user) {
        console.log("in Change user")
        if(TokenManager.requestAuthorized(this.req)){
            if (User.valid(user)) {
                let foundUser = this.usersRepository.findByField('Email', user.Email);
                if (foundUser != null){
                    if (foundUser.Id != user.Id) {
                        this.response.conflict();
                        return;
                    }
                }
                if (this.usersRepository.update(user))
                    this.response.ok();
                else 
                    this.response.notFound();
            } else 
                this.response.unprocessable();
        }
        else
            this.response.unAuthorized();
    }
    // todo
    remove(id) {
        if(TokenManager.requestAuthorized(this.req)){
            if (this.usersRepository.remove(id)){
                this.removeAllBookmarksByUserId(id);
                this.response.accepted();
            }
            else
                this.response.notFound();
        }
        else
            this.response.unAuthorized();
    }

    removeAllBookmarksByUserId(id) {
        let bookmarksToRemove = this.bookmarksRepository.findByField('UserId', id);
        bookmarksToRemove.forEach(bookmark => {
            this.bookmarksRepository.remove(bookmark.Id)
        });
    }
}