import React, { useState, useEffect, useRef } from "react";
import './Video.css';
import VideoPlayer from './VideoPlayer/VideoPlayer';
import VideoSearch from './VideoSearch/VideoSearch';

import { sckt } from '../Socket';
import { insert } from './VideoHelper';

const Video = ({ log, name, room, videoProps, updateState, playerRef, sendVideoState, loadVideo, playVideoFromSearch }) => {

    useEffect(() => {
        // Send videoProps to new user
        sckt.socket.on("getSync", ({ id }) => {
            log("New user needs videoProps to sync.", 'server');
            if (playerRef.current != null && playerRef.current.internalPlayer != null) {
                let player = playerRef.current.internalPlayer;
                player.getCurrentTime().then((currTime) => {
                    let params = {
                        id: id,
                        ...videoProps,
                        seekTime: currTime,
                        receiving: true
                    }
                    sckt.socket.emit('sendSync', params, (error) => { });
                });
            }
        });
    });
    useEffect(() => {
        // Sync other user's videoProps to our state
        sckt.socket.on("startSync", (videoProps) => {
            log("I'm syncing.", 'server');
            updateState({ ...videoProps });
            modifyVideoState({ ...videoProps });
            // loadVideo(videoProps.history[0], true);
        });
        // Update single value in videoProps from other user
        sckt.socket.on("receiveVideoState", ({ name, room, eventName, eventParams = {} }) => {
            const { seekTime, playbackRate, queue, searchItem, history } = eventParams;
            updateState({ receiving: true });
            switch (eventName) {
                case 'syncPlay':
                case 'syncSeek':
                    updateState({ playing: true, seekTime });
                    modifyVideoState({ playing: true, seekTime });
                    break;
                case 'syncPause':
                    updateState({ playing: false });
                    modifyVideoState({ playing: false });
                    break;
                case 'syncRateChange':
                    updateState({ playbackRate });
                    modifyVideoState({ playbackRate });
                    break;
                case 'syncLoad':
                    loadVideo(searchItem, false);
                    updateState({ history });
                    break;
                case 'syncLoadFromQueue':
                    loadFromQueue(queue);
                    break;
                case 'syncQueue':
                    updateState({ queue });
                    break;
                default:
                    break;
            }
        });
    }, []);
    const loadFromQueue = (queue, sync = false) => {
        let nextVideo = queue.shift(); // Remove from beginning of queue
        if (nextVideo !== undefined) {
            loadVideo(nextVideo, sync);
            updateState({ queue });
            updateState({ history: [nextVideo, ...videoProps.history] });
        }
    }
    const modifyVideoState = (paramsToChange) => {
        if (playerRef.current != null && playerRef.current.internalPlayer != null) {
            const { lastStateYT } = videoProps;
            const { playing, seekTime, playbackRate } = paramsToChange;
            let player = playerRef.current.internalPlayer;
            if (playing !== undefined) {
                if (playing) {
                    if(seekTime) player.seekTo(seekTime);
                    // If not already playing
                    if (lastStateYT != 1 || lastStateYT != 3)
                        player.playVideo();
                } else {
                    // If not already paused
                    if (lastStateYT != 2)
                        player.pauseVideo();
                }
            } else if (playbackRate !== undefined) {
                player.setPlaybackRate(playbackRate);
            }
        }
    }
    const addVideoToQueue = (searchItem) => {
        let { queue } = videoProps;
        let updatedQueue = insert(queue, queue.length, searchItem)
        sendVideoState({
            eventName: "syncQueue",
            eventParams: {
                queue: updatedQueue
            }
        });
        updateState({ queue: updatedQueue });
    }
    // // Debugging
    // useEffect(() => {
    //     console.log("Queue: ", videoProps.queue);
    // }, [videoProps.queue])
    // useEffect(() => {
    //     console.log("History: ", videoProps.history);
    // }, [videoProps.history])


    return (
        <div className="videoContainer">
            <VideoPlayer
                log={log}
                videoProps={videoProps}
                sendVideoState={sendVideoState}
                updateState={updateState}
                playerRef={playerRef}
                loadVideo={loadVideo}
                loadFromQueue={loadFromQueue}
            />
            <VideoSearch
                addVideoToQueue={addVideoToQueue}
                playVideoFromSearch={playVideoFromSearch}
            />
        </div>
    );
}

export default Video;