import React, { useEffect, useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import socketIOClient from "socket.io-client";
import _ from 'lodash';
import api from '../api';

const ENDPOINT = process.env.REACT_APP_SERVER_BASE_URL;


function Stream() {

    const [eventList, setEventList] = useState([]);
    const [liveStream, setLiveStream] = useState(null);

    useEffect(() => {
        // Subscribe to events for this streamer
        let result = api.post('/api/subscribe', {
            userId: JSON.parse(localStorage.getItem('fav_streamer')).id
        });
        const socket = socketIOClient(ENDPOINT, {query: 'token=' + localStorage.getItem('jwt_token')});
        socket.on("to_follow", data => {
            if (data && data.length) {
                let msg = data[0].from_name + ' just followed ' + data[0].to_name;
                setEventList(eventList => [msg, ..._.slice(eventList, 0, 9)]);
            }
        });
        socket.on("stream_change", data => {
            if (data && data.length) {
                let msg = data.username + ' just went ' + data.type + ' with stream ' + data.title;
                setEventList(eventList => [msg, ..._.slice(eventList, 0, 9)]);
            }
        });


        // Get fav streamer's active stream
        const fetchActiveStream = async () => {
            
            try {
                result = await api.get('https://api.twitch.tv/helix/search/channels?live_only=true&query=' + JSON.parse(localStorage.getItem('fav_streamer')).display_name);
            } catch (err) {
                // Try refreshing the token
                let creds = await api.post('/auth/refresh_token');
                localStorage.setItem('access_token', creds.data.accessToken);
                result = await api.get('https://api.twitch.tv/helix/search/channels?live_only=true&query=' + JSON.parse(localStorage.getItem('fav_streamer')).display_name);
            }
            if (result.data.data && result.data.data.length) {
                const ls = result.data.data[0];
                // Get video for this game
                console.log(ls);
                if (ls.is_live) {
                    setLiveStream(ls.display_name);
                }
            }
        }

        fetchActiveStream();

        // Cleanup
        return () => {
            // Unsubscribe webhooks
            api.post('/api/unsubscribe', {
                userId: JSON.parse(localStorage.getItem('fav_streamer')).id
            });
            socket.disconnect();
        }
    }, []);


    return (
        <Container>
            <Row>
                <Col>
                    <h2>Livestream</h2>
                    {liveStream ? <iframe
                        src={'https://player.twitch.tv/?channel=' + liveStream + '&parent=localhost'}
                        height="300"
                        width="300"
                        frameBorder="10"
                        scrolling="no"
                        allowFullScreen={true}>
                    </iframe> : <p>No live streams right now!</p>}
                </Col>
                <Col>
                    <h2>Chat</h2>
                    {liveStream ? <iframe 
                        frameBorder="10"
                        scrolling="no"
                        id='chat_embed'
                        src={'http://www.twitch.tv/embed/' + liveStream + '/chat?parent=localhost'}
                        height="300"
                        width="300">
                    </iframe> : <p>No live streams right now!</p>}
                </Col>
                <Col>
                    <div>
                        <h2>Events</h2>
                        { eventList.length ? 
                            <div>{eventList.map((msg) => <li>{msg}</li>)}</div> :
                            <p>Waiting for first event</p>
                        }
                    </div>
                </Col>
            </Row>
        </Container>
    )
}

export default Stream;