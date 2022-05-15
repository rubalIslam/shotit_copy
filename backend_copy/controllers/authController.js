const User = require('../models/user');

const ErrorHandler = require('../utils/errorHandler');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const sendToken = require('../utils/jwtToken');
const sendEmail = require('../utils/sendEmail');

const crypto = require('crypto');
const cloudinary = require('cloudinary');
const product = require('../models/product');

// Register a user   => /api/v1/register
/*==============POST==================
http://localhost:5000/api/v1/register
{
    "name":"admin@gmail.com",
    "email":"admin@gmail.com",
    "password":"admin123"
}
*/
exports.registerUser = catchAsyncErrors(async (req, res, next) => {

    const { name, email, password } = req.body;
    
    if (req.body.avatar){
        console.log("running if") 
        const result = await cloudinary.v2.uploader.upload(req.body.avatar, {
            folder: 'avatars',
            width: 150,
            crop: "scale"
        })
        const user = await User.create({
            name,
            email,
            password,
            avatar: {
                public_id: result.public_id,
                url: result.secure_url
            }
        })
    } 
    else{
        console.log("running else")
        const user = await User.create({
            name,
            email,
            password,
            avatar: {
                public_id: "",
                url: ""
            }
        })
    }

    sendToken(user, 200, res)

})
// Login User  =>  /a[i/v1/login admin_token = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYyN2ZhMWZhMGRiMWJiNDE0NGUxYTdhMyIsImlhdCI6MTY1MjUzMjAyMSwiZXhwIjoxNjUzODI4MDIxfQ.dw2Yv4bknDaqW0KuEL_LzLEcfdUdWxjsHj9acQtt4W0
/*================POST=================
http://localhost:5000/api/v1/login/
{
    "email":"rubal@gmail.com",
    "password":"rubal123"
}
*/
exports.loginUser = catchAsyncErrors(async (req, res, next) => {
    const { email, password } = req.body;

    // Checks if email and password is entered by user
    if (!email || !password) {
        return next(new ErrorHandler('Please enter email & password', 400))
    }

    // Finding user in database
    const user = await User.findOne({ email }).select('+password')

    if (!user) {
        return next(new ErrorHandler('Invalid Email or Password', 401));
    }

    // Checks if password is correct or not
    const isPasswordMatched = await user.comparePassword(password);

    if (!isPasswordMatched) {
        return next(new ErrorHandler('Invalid Email or Password', 401));
    }

    sendToken(user, 200, res)
})

// Forgot Password   =>  /api/v1/password/forgot
exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {

    const user = await User.findOne({ email: req.body.email });

    if (!user) {
        return next(new ErrorHandler('User not found with this email', 404));
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Create reset password url
    const resetUrl = `${req.protocol}://${req.get('host')}/password/reset/${resetToken}`;

    const message = `Your password reset token is as follow:\n\n${resetUrl}\n\nIf you have not requested this email, then ignore it.`

    try {

        await sendEmail({
            email: user.email,
            subject: 'ShopIT Password Recovery',
            message
        })

        res.status(200).json({
            success: true,
            message: `Email sent to: ${user.email}`
        })

    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save({ validateBeforeSave: false });

        return next(new ErrorHandler(error.message, 500))
    }

})

// Reset Password   =>  /api/v1/password/reset/:token
exports.resetPassword = catchAsyncErrors(async (req, res, next) => {

    // Hash URL token
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex')

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    })

    if (!user) {
        return next(new ErrorHandler('Password reset token is invalid or has been expired', 400))
    }

    if (req.body.password !== req.body.confirmPassword) {
        return next(new ErrorHandler('Password does not match', 400))
    }

    // Setup new password
    user.password = req.body.password;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    sendToken(user, 200, res)

})


// Get currently logged in user details   =>   /api/v1/me
exports.getUserProfile = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.user.id);

    res.status(200).json({
        success: true,
        user
    })
})


// Update / Change password   =>  /api/v1/password/update
exports.updatePassword = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.user.id).select('+password');

    // Check previous user password
    const isMatched = await user.comparePassword(req.body.oldPassword)
    if (!isMatched) {
        return next(new ErrorHandler('Old password is incorrect'));
    }

    user.password = req.body.password;
    await user.save();

    sendToken(user, 200, res)

})


// Update user profile   =>   /api/v1/me/update
exports.updateProfile = catchAsyncErrors(async (req, res, next) => {
    const newUserData = {
        name: req.body.name,
        email: req.body.email
    }

    // Update avatar
    if (req.body.avatar !== '') {
        const user = await User.findById(req.user.id)

        const image_id = user.avatar.public_id;
        const res = await cloudinary.v2.uploader.destroy(image_id);

        const result = await cloudinary.v2.uploader.upload(req.body.avatar, {
            folder: 'avatars',
            width: 150,
            crop: "scale"
        })

        newUserData.avatar = {
            public_id: result.public_id,
            url: result.secure_url
        }
    }

    const user = await User.findByIdAndUpdate(req.user.id, newUserData, {
        new: true,
        runValidators: true,
        useFindAndModify: false
    })

    res.status(200).json({
        success: true
    })
})


// Logout user   =>   /api/v1/logout
exports.logout = catchAsyncErrors(async (req, res, next) => {
    res.cookie('token', null, {
        expires: new Date(Date.now()),
        httpOnly: true
    })

    res.status(200).json({
        success: true,
        message: 'Logged out'
    })
})

// Admin Routes

// Get all users   =>   /api/v1/admin/users
exports.allUsers = catchAsyncErrors(async (req, res, next) => {
    const users = await User.find();

    res.status(200).json({
        success: true,
        users
    })
})


// Get user details   =>   /api/v1/admin/user/:id
exports.getUserDetails = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new ErrorHandler(`User does not found with id: ${req.params.id}`))
    }

    res.status(200).json({
        success: true,
        user
    })
})

// Update user profile   =>   /api/v1/admin/user/:id
exports.updateUser = catchAsyncErrors(async (req, res, next) => {
    const newUserData = {
        name: req.body.name,
        email: req.body.email,
        role: req.body.role
    }

    const user = await User.findByIdAndUpdate(req.params.id, newUserData, {
        new: true,
        runValidators: true,
        useFindAndModify: false
    })

    res.status(200).json({
        success: true
    })
})

// Delete user   =>   /api/v1/admin/user/:id
exports.deleteUser = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new ErrorHandler(`User does not found with id: ${req.params.id}`))
    }

    // Remove avatar from cloudinary
    const image_id = user.avatar.public_id;
    await cloudinary.v2.uploader.destroy(image_id);

    await user.remove();

    res.status(200).json({
        success: true,
    })
})
/* ==============put========================
http://localhost:5000/api/v1/addtocart/61f11e2b21119d26b4d2af61
{
    "product":"61f102a5f04fea1854629a5a",
    "name":"new cart element",
    "price":"200rs",
    "image":"https://res.cloudinary.com/bookit/image/upload/v1606231281/products/headphones_t2afnb.jpg",
    "stock":"3",
    "quantity":3
}
*/
exports.addToCart = catchAsyncErrors(async (req,res, next) =>{
    let user = await User.findById(req.params.id);

    const { product, name, price, image,stock,quantity} = req.body;

    const cartData = {
        product: req.body.product,
        name: req.body.name,
        price: req.body.name,
        image: req.body.image,
        stock: req.body.stock,
        quantity:req.body.quantity
    }

    console.log(req)

    if (!user){
        return next(new ErrorHandler('product not found',404));
    }

    user.cart.push(cartData);

    await user.save({ 
        validateBeforeSave: false
    });
    
    res.status(200).json({
        success:true,
        user
    })
})
/*
exports.addToCart = catchAsyncErrors(async (req,res, next) =>{
    let user = await User.findById(req.params.id);

    const { product, name, price, image,stock,quantity} = req.body;

    const cartData = {
        product: req.body.product,
        name: req.body.name,
        price: req.body.name,
        image: req.body.image,
        stock: req.body.stock,
        quantity:req.body.quantity
    }

    console.log(req.body)

    if (!user){
        return next(new ErrorHandler('product not found',404));
    }

    user.cart.push(cartData);

    await user.save({ 
        validateBeforeSave: false
    });
    
    res.status(200).json({
        success:true,
        user
    })
})
*/
// ========================== [works] delete =======================
/*
http://localhost:5000/api/v1/deleteFromCartById/61f11e2b21119d26b4d2af61
{
    "userId":"61f11e2b21119d26b4d2af61",
    "cartId":"61f64331c511331628adfc48"
}
*/
exports.deleteFromCartById = catchAsyncErrors(async (req,res, next) =>{
    //let cartId = await User.findById();
    
    let user = await User.findById(req.body.userId);
    //console.log(tempuser['cart'])
    cartid = req.body.cartId
    
    //deleteId = user['cart'].find(x => x._id == cartid)
    deleteId = user['cart'].filter(x => x._id == cartid)[0]

    console.log(deleteId)

    //delete user.cart.

    const cartDatas = user['cart'].filter(
        //cartData => cartData._id.toString() !== req.body.cartId.toString()
        //cartData => user['cart']._id.toString() != deleteId.toString()
        cartData => cartData._id.toString() !== req.body.cartId.toString()
    );

    //console.log("cartData::",cartDatas);

    await User.findByIdAndUpdate(req.body.userId,{
        $pull: {cart: deleteId} 
    },{
        new: true,
        runValidators: true,
        useFindAndModify:true
    })

    res.status(200).json({
        success:true,
        userId:req.params.id,
        cartData:cartDatas
    })
})

//================[Does not work] =============================== need to fix
exports.deleteFromCart = catchAsyncErrors(async (req,res, next) =>{
    let user = await User.findById(req.query.userId);

    console.log("query::",req.query)

    console.log(user)

    const cartDatas = user.cart.filter(
        cartData => cartData._id.toString() !== req.query.id.toString()
    );

    console.log("cartData::",cartDatas);

    await User.findByIdAndUpdate(req.query.userId,{
        cartDatas
    },{
        new: true,
        runValidators: true,
        useFindAndModify:false
    })

    res.status(200).json({
        success:true,
        userId:req.query.userId,
        cartData:cartDatas
    })
})

