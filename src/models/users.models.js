const mongoose= require("mongoose");
const bcrypt= require("bcrypt");

const userSchema = new mongoose.Schema(
    {
        email:{
            type:String,
            required:true,
            unique:true,
        },
        username:{
            type:String,
            required:true,
            unique:true,
            index:true,
        },
        password:{
            type:String,
            required:true,
            select:false,
        },
        is_online:{
            type:Boolean,
            default:false,
        },
        last_seen:{
            type:Date,
            default:Date.now,
        },
        refreshToken:{
            type:String,
            default:null,
            select:false,
        }
    },
    {
        timestamps:true,
    }
);
userSchema.pre("save",async function(){
    if(!this.isModified("password")) return  ;
    const salt = await bcrypt.genSalt(10);

    this.password= await bcrypt.hash(this.password,salt);
 
});

userSchema.methods.comparePassword= async function (filledPassword) {
    return bcrypt.compare(filledPassword,this.password);
};

module.exports=mongoose.model("User",userSchema);