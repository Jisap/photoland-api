// stripe

const stripe = require("stripe")(process.env.STRIPE_KEY);


'use strict';

/**
 * order controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

// nombre del controlador 'api::order.order -> Se utiliza para asociar las rutas y las acciones del controlador en Strapi
// call back -> define la lógica del controlador
// ctx -> objeto que contiene información sobre la solicitud entrante y proporciona métodos y propiedades para interactuar con ella y enviar una respuesta al cliente.

module.exports = createCoreController('api::order.order',({strapi}) => ({
    async create(ctx) {                                             // create inicia el proceso de análisis del carrito y realiza un pago con stripe.        
        const { cart } = ctx.request.body;                          // Recupera el objeto cart del cuerpo de la solicitud    
        if(!cart){                                                  // Se verifica que el objeto existe sino mensaje de error
            ctx.response.status = 400;
            return { error: "Cart not found in request body"};
        }
        const lineItems = await Promise.all(                        // Resolución de promesas en un array de resultados
            cart.map( async (product) => {                          // mapeamos el carrito
                const item = await strapi                           // contruimos items usando la ruta de strapi donde se guardan los productos
                    .service("api::product.product")                // y el id que viene en la petición
                    .findOne(product.id);
                return {                                            // obtenidos los items del carrito devolvemos un [{}]    
                    price_data:{                                    // con la info que stripe necesita.
                        currency: "usd",
                        product_data: {
                            name: item.title,
                        },
                        unit_amount: item.price * 100,
                    },
                    quantity: product.amount,
                };
            })    
        );
        try {
            const session = await stripe.checkout.sessions.create({ // Utilizamos el objeto stripe para crear una session de pago
                mode: "payment",
                success_url: `${process.env.CLIENT_URL}?success=true`,
                cancel_url: `${process.env.CLIENT_URL}?success=false`,
                line_items: lineItems,
                shipping_address_collection: {
                    allowed_countries: ["US","CA"]
                },
                payment_method_types: ["card"]
            });
            await strapi.service("api::order.order").create({   // despues se crea un registro en base de datos  con la info de la session de pago
                data: {
                    products:cart,
                    stripeId: session.id,
                },
            });
            return {stripeSession: session} // y se devuelve la info de dicha session
        } catch (error) {
            ctx.response.status = 500;
        }
    },
}));
