import React, {useEffect} from 'react';
import { Container } from 'react-bootstrap';
import socketIOClient from "socket.io-client";

const ENDPOINT = "http://127.0.0.1:4000";

function Chat() {


    useEffect(() => {
        const socket = socketIOClient(ENDPOINT);

        // Cleanup
        return () => socket.disconnect();
    }, []);


    return (
        <Container>

        </Container>
    )
}

export default Chat;