const jwt = require("jsonwebtoken");

const authenticate= async (req,res,next)=>{
    const authHeader= req.headers.authorization;
    const token=authHeader && authHeader.startsWith("Bearer ")?authHeader.split(" ")[1]:null;

    if(!token){
        return res.status(401).json(
            {
                success:false,
                message:"Access token is missing"
            }
        );
    }

    try {
        const decoded= jwt.verify(token, process.env.ACCESSTOKEN);
    
        req.user= decoded;
    
        next();
    } catch (error) {
        if(error.name==="TokenExpiredError"){
            return res.status(401).json(
                {
                    success:false,
                    message:"Access Token expired"
                }
            );
        }
        return res.status(401).json(
            {
                success:false,
                message:"Invalid access token"
            }
        );
    }
};

module.exports={authenticate};