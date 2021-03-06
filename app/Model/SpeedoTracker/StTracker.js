'use strict'
const Lucid = use('Lucid');
const Database = use('Database');
const Validator = use('Validator');
const Niddar = use("App/Niddar");
const Setting = use("App/Model/Niddar/Setting");

const StToken = use("App/Model/SpeedoTracker/StToken");
const StSocket = use("App/Model/SpeedoTracker/StSocket");
const StUser = use("App/Model/SpeedoTracker/StUser");

const table = "st_trackers";
var result = {};
class StTracker extends Lucid {

    //---------------------------------------------
    static get table() {
        return table;
    }

    //---------------------------------------------
    static get deleteTimestamp() {
        return null
    }

    //---------------------------------------------
    static get dateFormat() {
        return 'YYYY-MM-DD HH:mm:ss'
    }
    //---------------------------------------------
    user() {
        return this.belongsTo('App/Model/SpeedoTracker/StUser', 'id', 'core_user_id')
    }
    //---------------------------------------------
    tracker() {
        return this.belongsTo('App/Model/SpeedoTracker/StUser', 'id', 'tracker_user_id')
    }
    //---------------------------------------------
    socket() {
        return this.belongsTo('App/Model/SpeedoTracker/StSocket', 'core_user_id', 'tracker_user_id')
    }
    //---------------------------------------------

    //---------------------------------------------
    static createRules() {
        return {
            validation: {
                core_user_id: 'required',
                tracker_user_id: 'required',
                status: 'required',
            },
            messages: {
                'core_user_id.required': Niddar.helper.validationMessages('required', 'User id'),
                'tracker_user_id.required': Niddar.helper.validationMessages('required', 'User id of the tracker'),
                'status.required': Niddar.helper.validationMessages('required', 'Request status'),
            },
            sanitize: {
            }
        }
    }
    //---------------------------------------------
    static updateRules() {
        return {
            validation: {
                id: 'required',
            },
            messages: {
                'id.required': Niddar.helper.validationMessages('required', 'ID'),
            },
            sanitize: {
            }
        }
    }
    //---------------------------------------------
    *getColumnList()
    {
        var list =yield Database.table(table).columnInfo();
        var result = {};
        var i = 0;
        Object.keys(list).forEach(function(key) {
            result[i] = key;
            i++;
        });
        return result;
    }
    //---------------------------------------------
    *createItem(input) {
        //..............validation
        const validation = yield Validator
            .validateAll(input, StTracker.createRules().validation, StTracker.createRules().messages);
        if (validation.fails()) {
            var result = {
                status: "failed",
                errors: validation.messages()
            };
            return result;
        }
        var stTracker = new StTracker();

        //..............if exist record exist then return value with warning
        var item = yield StTracker.query()
            .where('core_user_id', input.core_user_id)
            .where('tracker_user_id', input.tracker_user_id)
            .first();
        if (item) {
            result = {
                status: "warning",
                data: item,
                messages: [
                    {
                        type: "error",
                        message: "Record already exist"
                    }
                ]
            };
            return result;
        }

        //..............create the record
        var item = new StTracker();
        var columns = yield stTracker.getColumnList();

        try {
            for(var key in columns) {
                var column_name = columns[key];
                if (input.hasOwnProperty(column_name)) {
                    item[column_name] = input[column_name];
                }
            }
            yield item.save();
            result = {
                status: "success",
                data: item,
                messages: [
                    {
                        type: "success",
                        message: "Record created"
                    }
                ]
            };
        } catch (e) {
            result = {
                status: "failed",
                errors: [{message: e.message}]
            };
        }
        return result;
    }
    //---------------------------------------------
    *updateItem(input) {
        //..............validation
        const validation = yield Validator
            .validateAll(input, StTracker.updateRules().validation, StTracker.updateRules().messages);
        if (validation.fails()) {
            var result = {
                status: "failed",
                errors: validation.messages()
            };
            return result;
        }


        //..............
        var item = yield StTracker.find(input.id);
        var columns = yield item.getColumnList();

        try {
            for(var key in columns) {
                var column_name = columns[key];
                if (input.hasOwnProperty(column_name)) {
                    item[column_name] = input[column_name];
                }
            }
            yield item.save();
            result = {
                status: "success",
                data: item,
                messages: [
                    {
                        type: "success",
                        message: "Record updated"
                    }
                ]
            };
        } catch (e) {
            result = {
                status: "failed",
                errors: [{message: e.message}]
            };
        }
        return result;
    }
    //---------------------------------------------

    //---------------------------------------------
    //---------------------------------------------
    *createFromToken(input)
    {
        var stToken = yield StToken.findBy("token", input.token);
        var user = yield stToken.user().first();
        input.tracker_user_id = user.id;

        if (typeof input.status === 'undefined'){
            input.status = "pending";
        }

        var stTracker = new StTracker();
        result = yield stTracker.createItem(input);
        return result;
    }
    //---------------------------------------------
    *trackers(core_user_id)
    {
        var list = yield StTracker.query().where('core_user_id', core_user_id).fetch();
        return list;
    }

    //---------------------------------------------

    //---------------------------------------------
    *trackersFromToken(token)
    {
        var getToken = yield StToken.findBy('token', token);
        var user = yield getToken.user().first();
        var stUser = yield StUser.find(user.id);
        var trackers = yield stUser.trackers().with('socket.user').fetch();
        trackers = trackers.toJSON();
        //return trackers;

        if(trackers)
        {

            var list = [];
            var i = 0;
            var tracker;
            for(var item in trackers )
            {
                tracker = trackers[item];
                if(tracker.socket)
                {
                    list[i] = {
                        socket: tracker.socket.socket_id,
                        email: tracker.socket.user.email,
                        user_id: tracker.socket.user.id,
                    };
                    i++;
                }

            }

            result = {
                status: "success",
                data: list
            };

            return result;
        } else
        {
            result = {
                status: "failed",
                errors: [{message: "No tracker found"}]
            } ;
            return result;
        }
    }
    //---------------------------------------------
    *trackersList(input)
    {

        if (typeof input.page === 'undefined') {
            input.page = 1;
        }
        var list = yield StTracker.query().select('id', 'core_user_id', 'tracker_user_id')
            .where('core_user_id', input.user.id)
            .where("status", '=', input.status)
            .with('tracker')
            .scope('tracker', function (builder) {
                builder.select('id', 'first_name', 'last_name', 'email', 'core_country_id', 'mobile')
                    .with('token')
                    .with('socket')
            })

            .paginate(input.page, 1);

        result = {
            status: "success",
            data: list
        }

        return result;

    }
    //---------------------------------------------
    *changeStatus(input)
    {
        var rules = {
            user: "required",
            tracker_user_id: "required",
            status: "required",
        };
        const validation = yield Validator.validateAll(input, rules);
        if (validation.fails()) {
            var result = {
                status: "failed",
                errors: validation.messages()
            };
            return result;
        }

        var trackerRequest = yield StTracker.query().where('core_user_id', input.user.id)
            .where('tracker_user_id', input.tracker_user_id)
            .first();

        if(trackerRequest)
        {
            trackerRequest.status = input.status;
            yield trackerRequest.save();
        }

        result = {
            status: 'success',
            data: trackerRequest
        };

        return result;

    }
    //---------------------------------------------
    *trackerRequest(input)
    {
        if (typeof input.mobile === 'undefined' || typeof input.email === 'undefined')
        {
            result = {
                status: "failed",
                errors: [{message: "you must pass email or mobile number of the user"}]
            };
            return result;
        }

        //check user is registered or not
        if (input.hasOwnProperty('email'))
        {
            var item = yield StUser.findBy("email", input.email);
        } else if(input.hasOwnProperty('email'))
        {
            var item = yield StUser.findBy("mobile", input.mobile);
        }

        if(!item)
        {
            result = {
                status: "invite",
                errors: [{message: "No user have registered with the email or mobile. You should invited the user"}]
            };
            return result;
        }
        input.core_user_id = item.id;


        if (input.hasOwnProperty('user') &&  typeof input.created_by === 'undefined') {
            input.created_by = input.user.id;
        }
        if (input.hasOwnProperty('user') && typeof input.tracker_user_id === 'undefined') {
            input.tracker_user_id = input.user.id;
        }

        var tracker = new StTracker();

        result = yield tracker.createOrUpdate(input);

        return result;
    }
    //---------------------------------------------
    *createOrUpdate(input)
    {
        var stTracker = new StTracker();
        if (typeof input.core_user_id !== 'undefined'){
            var item = yield StTracker.findBy('core_user_id', input.core_user_id);
            if(item)
            {
                input.id = item.id;
                result = yield stTracker.updateItem(input);
            } else
            {
                result = yield stTracker.createItem(input);
            }
        } else
        {
            result = yield stTracker.createItem(input);
        }

        if(result.status == "success" && result.data.status == "pending")
        {
            var user = yield StUser.query().where('id', result.data.core_user_id)
                    .select("id", "email", "first_name", "last_name", "mobile")
                    .with('socket')
                    .first()
                ;

            result = {
                status: "success",
                data: {
                    request: result.data,
                    user: user
                }
            }
        }

        return result;
    }
    //---------------------------------------------
}
module.exports = StTracker
