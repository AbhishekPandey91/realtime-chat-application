const User = require("../models/users.models");

const searchUsers = async (req,res)=>{
    try {
        const{q}= req.query;
    
        if(!q || !q.trim()){
            return res.status(400).json(
                {
                    success:false,
                    messsage:"Search query is required"
                }
            );
        }
    
        const users = await User.find(
            {
                username:{$regex:q},
                _id:{$ne:req.user.userId},
            }
        ).select("username email is_online last_seen");
    
        return res.status(200).json(
            {
                success:true,
                data:users,
            }
        );
    } catch (error) {
        console.error("searchedUsers error: ",error);
        return res.status(500).json(
            {
                success:false,
                message:"Something went wrong"
            }
        );
    }
};

module.exports= {searchUsers};