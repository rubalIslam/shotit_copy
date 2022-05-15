import axios from 'axios'
import { ADD_TO_CART, REMOVE_ITEM_CART, SAVE_SHIPPING_INFO } from '../constants/cartConstants'
import { ADD_TO_USERCART } from "../constants/userConstants"

import APP_API from "../config";

export const addItemToCart = (id, quantity, userId) => async (dispatch, getState) => {
    const { data } = await axios.get(`${APP_API}/product/${id}`)
    const config = {
        headers: {
            'Content-Type': 'application/json'
        }
    }
    console.log("para::",quantity,userId)

    let product = data.product._id
    let name = data.product.name
    let price= data.product.name
    let image= data.product.images[0].url
    let stock= data.product.stock
    
    //http://localhost:5000/api/v1/addtocart/61f11e2b21119d26b4d2af61
    const { resData } = await axios.post(`${APP_API}addtocart/${userId}`, {
        product,name,price,image,stock,quantity
    }, config)
    console.log(resData)

    localStorage.setItem('cartItems', JSON.stringify(getState().cart.cartItems))

    dispatch({
        type: ADD_TO_USERCART,
        payload: resData
    })
    /*
    dispatch({
        type: ADD_TO_CART,
        payload: {
            product: data.product._id,
            name: data.product.name,
            price: data.product.price,
            image: data.product.images[0].url,
            stock: data.product.stock,
            quantity
        }
    })
    */
}

export const removeItemFromCart = (id) => async (dispatch, getState) => {

    dispatch({
        type: REMOVE_ITEM_CART,
        payload: id
    })

    localStorage.setItem('cartItems', JSON.stringify(getState().cart.cartItems))

}

export const saveShippingInfo = (data) => async (dispatch) => {

    dispatch({
        type: SAVE_SHIPPING_INFO,
        payload: data
    })

    localStorage.setItem('shippingInfo', JSON.stringify(data))

}